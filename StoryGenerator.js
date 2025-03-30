export class StoryGenerator {
  constructor(storyManager) {
    this.storyManager = storyManager;
    this.currentPage = 1;
    this.storyData = null;
    this.storyHistory = [];
    this.hasMoreContent = true; // Track if the story can continue
    this.isGenerating = false; // Prevent multiple simultaneous generations
    this.imageCache = new Map();
    this.loadImageCache();
    this.setupEventListeners();
  }

  loadImageCache() {
    try {
      const savedCache = localStorage.getItem('storyImageCache');
      if (savedCache) {
        this.imageCache = new Map(JSON.parse(savedCache));
      }
    } catch (error) {
      console.error('Error loading image cache:', error);
    }
  }

  saveImageCache() {
    try {
       // Limit cache size (e.g., 50 items) to prevent excessive localStorage usage
       const MAX_CACHE_SIZE = 50;
       while (this.imageCache.size > MAX_CACHE_SIZE) {
           // Delete the oldest entry (Map iterates in insertion order)
           const oldestKey = this.imageCache.keys().next().value;
           this.imageCache.delete(oldestKey);
       }
      localStorage.setItem('storyImageCache', JSON.stringify([...this.imageCache]));
    } catch (error) {
       console.error('Error saving image cache:', error);
       // Potentially clear cache if saving fails due to size limits
       if (error.name === 'QuotaExceededError') {
           console.warn('Image cache size limit exceeded. Clearing cache.');
           this.imageCache.clear();
           localStorage.removeItem('storyImageCache');
       }
    }
  }

  async generatePageImage(pageContent, pageId) {
    const cacheKey = `${this.storyManager.currentStoryId}_page_${pageId}`;

    if (this.imageCache.has(cacheKey)) {
        console.log(`Using cached image for page ${pageId}`);
        return this.createImageElement(cacheKey, pageId);
    }
    console.log(`Generating image for page ${pageId}...`);

    // Show loading indicator for image
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'story-page-image loading';
    loadingIndicator.textContent = 'Generating image...';
    // Insert the loading indicator temporarily
    const contentElement = document.getElementById('storyContent');
    const existingImage = contentElement.querySelector('.story-page-image');
    if(existingImage) existingImage.remove();
    contentElement.prepend(loadingIndicator);


    try {
      const result = await websim.imageGen({
        prompt: `Illustrate this scene from a story: ${pageContent}. Style: ${this.storyData?.narrativeTone || 'neutral'}. Genre: ${this.storyData?.storyType || 'general'}.`,
        aspect_ratio: "16:9"
      });

      if (result && result.url) {
        console.log(`Image generated for page ${pageId}: ${result.url}`);
        this.imageCache.set(cacheKey, result.url);
        this.saveImageCache();
        loadingIndicator.remove(); // Remove loading indicator
        return this.createImageElement(cacheKey, pageId);
      } else {
           throw new Error("Image generation failed to return a URL.");
      }
    } catch (error) {
      console.error(`Error generating image for page ${pageId}:`, error);
      loadingIndicator.remove(); // Remove loading indicator on error
      // Return a placeholder div if image generation fails
      const placeholder = document.createElement('div');
      placeholder.className = 'story-page-image error';
      placeholder.textContent = 'Image generation failed';
      return placeholder;
    }
  }

  createImageElement(cacheKey, pageId) {
    const img = document.createElement('img');
    img.id = `page_${pageId}_image`;
    img.alt = `Illustration for page ${pageId}`;
    img.className = 'story-page-image'; // Use class for styling
    img.src = this.imageCache.get(cacheKey);
    img.onerror = () => {
        console.error(`Failed to load image from cache: ${cacheKey}`);
        img.alt = 'Error loading image';
        // Optionally replace with a placeholder or remove
        img.remove(); // Remove broken image element
    };
    return img;
  }

  async displayCurrentPage() {
    if (this.isGenerating) return; // Don't display while generating

    const pageIndex = this.currentPage - 1;
    if (pageIndex < 0 || pageIndex >= this.storyHistory.length) {
        console.error(`Invalid page index: ${pageIndex}`);
        // Maybe show an error message or navigate to the last valid page
        this.currentPage = Math.max(1, Math.min(this.currentPage, this.storyHistory.length));
        // Optionally, try to generate if we navigated to a non-existent "next" page
        if(this.currentPage > this.storyHistory.length && this.hasMoreContent) {
            console.log("Attempting to generate missing page content...");
            await this.generatePage(); // Try generating the next page if needed
        }
        return; // Exit if still invalid after correction/generation attempt
    }


    const currentContent = this.storyHistory[pageIndex];
    const contentElement = document.getElementById('storyContent');

    contentElement.innerHTML = ''; // Clear previous content

    // Display text content first
    const textDiv = document.createElement('div');
    textDiv.className = 'story-text';
    textDiv.textContent = currentContent || "Loading content..."; // Show loading text briefly
    contentElement.appendChild(textDiv);

    // Then generate and display the image *above* the text
    const imageElement = await this.generatePageImage(currentContent, this.currentPage);
    contentElement.prepend(imageElement); // Prepend adds it before the textDiv

    // Update navigation
    document.getElementById('pageNumber').textContent = `Page ${this.currentPage}`;
    document.getElementById('prevPage').disabled = this.currentPage === 1;
    // Disable next if we know there's no more content *or* if we are currently on the last fetched page
    document.getElementById('nextPage').disabled = !this.hasMoreContent && this.currentPage === this.storyHistory.length;

    this.storyManager.updatePDFButtonState();
  }

  setupEventListeners() {
    document.getElementById('generateBtn').addEventListener('click', () => this.startGeneratingNewStory());
    document.getElementById('prevPage').addEventListener('click', () => this.navigatePage('prev'));
    document.getElementById('nextPage').addEventListener('click', () => this.navigatePage('next'));
    document.getElementById('newStory').addEventListener('click', () => this.storyManager.startNewStory()); // Delegate to manager
  }

  async startGeneratingNewStory() {
        const formData = this.collectFormData();
        if (!this.validateForm(formData)) {
            alert('Please fill out all required fields!');
            return;
        }
        if (this.isGenerating) return;

        this.storyData = formData;
        this.currentPage = 1;
        this.storyHistory = [];
        this.hasMoreContent = true; // Reset for new story

        // Create a new story ID by calling saveStory without an existing ID
        this.storyManager.saveStory(this.storyData, this.currentPage, this.storyHistory);
        // storyManager.currentStoryId is now set

        document.getElementById('storyForm').style.display = 'none';
        document.getElementById('storyContainer').classList.remove('hidden');

        await this.generatePage(); // Generate the first page
   }

  async generatePage() {
    if (this.isGenerating) {
        console.warn("Generation already in progress.");
        return;
    }
    // Check if the page already exists
    if (this.currentPage > 0 && this.storyHistory[this.currentPage - 1]) {
      console.log(`Page ${this.currentPage} already exists. Displaying.`);
      await this.displayCurrentPage();
      return;
    }

    // Check if we know there's no more content
    if (!this.hasMoreContent) {
        console.log("No more content available for this story.");
        document.getElementById('nextPage').disabled = true;
        return;
    }

    this.isGenerating = true;
    const contentElement = document.getElementById('storyContent');
    contentElement.innerHTML = '<div class="loading-text">Generating story content...</div>'; // Show loading state
    document.getElementById('nextPage').disabled = true; // Disable next while generating
    document.getElementById('prevPage').disabled = true; // Disable prev while generating

    try {
        console.log(`Generating content for page ${this.currentPage}...`);
        const previousPagesContent = this.storyHistory.slice(0, this.currentPage -1); // Get content of pages before the current one

      // Construct the prompt for the AI
      const prompt = `You are a creative storyteller. Continue the story based on the provided parameters and previous content. Generate page ${this.currentPage} of the story. Ensure the story flows logically from the previous page. Keep the page length appropriate (around 150-300 words).

Story Parameters:
${JSON.stringify(this.storyData, null, 2)}

Previous Pages Content (if any):
${previousPagesContent.map((p, i) => `Page ${i+1}: ${p}`).join('\n\n')}
---
Generate the content for Page ${this.currentPage}. Respond ONLY with a JSON object matching this schema:
{
  "content": "The story text for page ${this.currentPage}...",
  "hasMoreContent": boolean // Set to false if this feels like a natural conclusion OR if the story length goal is met.
}`;

      const completion = await websim.chat.completions.create({
        messages: [
           // System message can guide the overall tone/style if needed
           // { role: "system", content: "You are a master storyteller." },
           { role: "user", content: prompt }
         ],
        // Request JSON output directly if the model supports it reliably
        // response_format: { type: "json_object" }, // Uncomment if using a model version that supports this reliably
        json: true // Use the websim helper for JSON parsing
      });

      // Parse the response content as JSON
      let data;
       try {
           data = JSON.parse(completion.content);
           if (typeof data.content !== 'string' || typeof data.hasMoreContent !== 'boolean') {
               throw new Error("Invalid JSON structure in response.");
           }
       } catch (parseError) {
           console.error("Failed to parse AI response as JSON:", parseError);
           console.error("Raw response:", completion.content);
           // Fallback: try to use the raw content if it looks like story text
           if (typeof completion.content === 'string' && completion.content.length > 50) {
                console.warn("Using raw response content as fallback.");
                data = { content: completion.content, hasMoreContent: true }; // Assume it can continue
           } else {
                throw new Error("Received invalid or unparseable response from AI.");
           }
       }


      this.storyHistory[this.currentPage - 1] = data.content;
      this.hasMoreContent = data.hasMoreContent;
      this.saveToStorage();

      await this.displayCurrentPage(); // Display the newly generated page and image

    } catch (error) {
      console.error('Error generating story page:', error);
      contentElement.innerHTML = `<div class="error-text">An error occurred while generating the story page ${this.currentPage}. Please try again or go back.</div>`;
       // Optionally re-enable previous button if error occurs
       document.getElementById('prevPage').disabled = this.currentPage === 1;
    } finally {
      this.isGenerating = false;
      // Re-enable buttons based on the new state
       document.getElementById('prevPage').disabled = this.currentPage === 1;
       document.getElementById('nextPage').disabled = (!this.hasMoreContent && this.currentPage === this.storyHistory.length) || this.isGenerating;

    }
  }

  async navigatePage(direction) {
     if (this.isGenerating) return; // Don't navigate while generating

    if (direction === 'prev') {
       if (this.currentPage > 1) {
            this.currentPage--;
            this.saveToStorage(); // Save current page before navigating
            await this.displayCurrentPage(); // Display the previous page
        }
    } else if (direction === 'next') {
        // Check if the next page already exists in history
        if (this.currentPage < this.storyHistory.length) {
            this.currentPage++;
            this.saveToStorage(); // Save current page before navigating
            await this.displayCurrentPage(); // Display existing next page
        } else if (this.hasMoreContent) {
            // If next page doesn't exist and story can continue, generate it
            this.currentPage++;
            // Note: saveToStorage will be called *within* generatePage after content is fetched
            await this.generatePage();
        } else {
            console.log("Already at the end of the story.");
            // Ensure 'Next' button is disabled if truly at the end
             document.getElementById('nextPage').disabled = true;
        }
    }
  }

  resetForm() {
    // This is now primarily handled by StoryManager.startNewStory
    // Kept here for potential direct calls if needed, but should be minimal
    const formElement = document.getElementById('storyFormElement');
    formElement.reset();
    // View switching is handled by StoryManager
    this.currentPage = 1;
    this.storyData = null;
    this.storyHistory = [];
    this.hasMoreContent = true;
    this.isGenerating = false;
    // Do NOT clear the currentStoryId here, let StoryManager handle it
  }

  collectFormData() {
    const formData = {};
    const form = document.getElementById('storyFormElement');
    const inputs = form.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
      if (input.id) {
        formData[input.id] = input.value.trim();
      }
    });

    return formData;
  }

  validateForm(formData) {
    // Add validation logic based on required fields in index.html
    const requiredFields = ['storyType', 'narrativeTone', 'storyLength', 'pov', 'structure', 'targetAge'];
    for (const field of requiredFields) {
        if (!formData[field]) {
             console.warn(`Validation failed: Missing field '${field}'`);
             return false;
        }
    }
    return true;
  }

  loadStory(story) {
    console.log("Loading story:", story.id, "Current Page:", story.currentPage);
    this.currentPage = story.currentPage;
    this.storyData = story.storyData;
    this.storyHistory = story.storyHistory;
    // Determine if more content *might* be possible. Assume true unless explicitly ended.
    // A more robust system could save the 'hasMoreContent' flag with the story.
    // For now, assume true if loading an existing story, generatePage will update if needed.
    this.hasMoreContent = true; // Reset this assumption on load
    this.isGenerating = false;

    // View switching is handled by StoryManager
    this.displayCurrentPage();
    // Check if the loaded page was the last known page and if hasMoreContent was potentially false previously
    // This logic needs refinement if 'hasMoreContent' is saved per story.
    if (this.currentPage === this.storyHistory.length) {
        // We don't know for sure if more content is possible without asking the AI again.
        // Let's tentatively enable the next button, generatePage will handle the rest.
         document.getElementById('nextPage').disabled = false; // Enable tentatively
         // A better approach would be to save the 'hasMoreContent' state with the story data.
         // For now, we'll try generating if 'next' is clicked.
    }

  }

  saveToStorage() {
    // Delegate saving to the StoryManager
    if (this.storyData && this.storyManager.currentStoryId) {
        this.storyManager.saveStory(this.storyData, this.currentPage, this.storyHistory);
    } else if (this.storyData) {
        // Handle saving a brand new story for the first time
        this.storyManager.saveStory(this.storyData, this.currentPage, this.storyHistory);
    }
  }
}