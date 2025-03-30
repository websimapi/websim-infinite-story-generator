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
      const MAX_CACHE_SIZE = 50;
      while (this.imageCache.size > MAX_CACHE_SIZE) {
        const oldestKey = this.imageCache.keys().next().value;
        this.imageCache.delete(oldestKey);
      }
      localStorage.setItem('storyImageCache', JSON.stringify([...this.imageCache]));
    } catch (error) {
      console.error('Error saving image cache:', error);
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

    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'story-page-image loading';
    loadingIndicator.textContent = 'Generating image...';
    const contentElement = document.getElementById('storyContent');
    const existingImage = contentElement.querySelector('.story-page-image');
    if (existingImage) existingImage.remove();
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
        loadingIndicator.remove();
        return this.createImageElement(cacheKey, pageId);
      } else {
        throw new Error("Image generation failed to return a URL.");
      }
    } catch (error) {
      console.error(`Error generating image for page ${pageId}:`, error);
      loadingIndicator.remove();
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
    img.className = 'story-page-image';
    img.src = this.imageCache.get(cacheKey);
    img.onerror = () => {
      console.error(`Failed to load image from cache: ${cacheKey}`);
      img.alt = 'Error loading image';
      img.remove();
    };
    return img;
  }

  async displayCurrentPage() {
    if (this.isGenerating) return;

    const pageIndex = this.currentPage - 1;
    if (pageIndex < 0 || pageIndex >= this.storyHistory.length) {
      console.error(`Invalid page index: ${pageIndex}`);
      this.currentPage = Math.max(1, Math.min(this.currentPage, this.storyHistory.length));
      if (this.currentPage > this.storyHistory.length && this.hasMoreContent) {
        console.log("Attempting to generate missing page content...");
        await this.generatePage();
      }
      return;
    }

    const currentContent = this.storyHistory[pageIndex];
    const contentElement = document.getElementById('storyContent');
    if (!contentElement) {
      console.error("Story content element not found!");
      return;
    }

    contentElement.innerHTML = '';

    const textDiv = document.createElement('div');
    textDiv.className = 'story-text';
    textDiv.textContent = currentContent || "Loading content...";
    contentElement.appendChild(textDiv);

    const imageElement = await this.generatePageImage(currentContent, this.currentPage);
    contentElement.prepend(imageElement);

    const pageNumEl = document.getElementById('pageNumber');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (pageNumEl) pageNumEl.textContent = `Page ${this.currentPage}`;
    if (prevBtn) prevBtn.disabled = this.currentPage === 1;
    if (nextBtn) nextBtn.disabled = (!this.hasMoreContent && this.currentPage === this.storyHistory.length) || this.isGenerating;

    this.storyManager.updatePDFButtonState();
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
    this.hasMoreContent = true;

    this.storyManager.saveStory(this.storyData, this.currentPage, this.storyHistory);

    const storyForm = document.getElementById('storyForm');
    const storyContainer = document.getElementById('storyContainer');
    if (storyForm) storyForm.style.display = 'none';
    if (storyContainer) storyContainer.classList.remove('hidden');

    await this.generatePage();
  }

  async generatePage() {
    if (this.isGenerating) {
      console.warn("Generation already in progress.");
      return;
    }

    if (this.currentPage > 0 && this.storyHistory[this.currentPage - 1]) {
      console.log(`Page ${this.currentPage} already exists. Displaying.`);
      await this.displayCurrentPage();
      return;
    }

    if (!this.hasMoreContent) {
      console.log("No more content available for this story.");
      const nextBtn = document.getElementById('nextPage');
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    this.isGenerating = true;
    const contentElement = document.getElementById('storyContent');
    if (!contentElement) {
      console.error("Cannot generate page, content element not found.");
      this.isGenerating = false;
      return;
    }
    contentElement.innerHTML = '<div class="loading-text">Generating story content...</div>';

    const nextBtn = document.getElementById('nextPage');
    const prevBtn = document.getElementById('prevPage');
    if (nextBtn) nextBtn.disabled = true;
    if (prevBtn) prevBtn.disabled = true;

    try {
      console.log(`Generating content for page ${this.currentPage}...`);
      const previousPagesContent = this.storyHistory.slice(0, this.currentPage - 1);

      const prompt = `You are a creative storyteller. Continue the story based on the provided parameters and previous content. Generate page ${this.currentPage} of the story. Ensure the story flows logically from the previous page. Keep the page length appropriate (around 150-300 words).

Story Parameters:
${JSON.stringify(this.storyData, null, 2)}

Previous Pages Content (if any):
${previousPagesContent.map((p, i) => `Page ${i + 1}: ${p}`).join('\n\n')}
---
Generate the content for Page ${this.currentPage}. Respond ONLY with a JSON object matching this schema:
{
  "content": "The story text for page ${this.currentPage}...",
  "hasMoreContent": boolean // Set to false if this feels like a natural conclusion OR if the story length goal is met.
}`;

      const completion = await websim.chat.completions.create({
        messages: [
          { role: "user", content: prompt }
        ],
        json: true
      });

      let data;
      try {
        data = JSON.parse(completion.content);
        if (typeof data.content !== 'string' || typeof data.hasMoreContent !== 'boolean') {
          throw new Error("Invalid JSON structure in response.");
        }
      } catch (parseError) {
        console.error("Failed to parse AI response as JSON:", parseError);
        console.error("Raw response:", completion.content);
        if (typeof completion.content === 'string' && completion.content.length > 50) {
          console.warn("Using raw response content as fallback.");
          data = { content: completion.content, hasMoreContent: true };
        } else {
          throw new Error("Received invalid or unparseable response from AI.");
        }
      }

      this.storyHistory[this.currentPage - 1] = data.content;
      this.hasMoreContent = data.hasMoreContent;
      this.saveToStorage();

      await this.displayCurrentPage();
    } catch (error) {
      console.error('Error generating story page:', error);
      if (contentElement) {
        contentElement.innerHTML = `<div class="error-text">An error occurred while generating the story page ${this.currentPage}. Please try again or go back.</div>`;
      }
      if (prevBtn) prevBtn.disabled = this.currentPage === 1;
    } finally {
      this.isGenerating = false;
      if (prevBtn) prevBtn.disabled = this.currentPage === 1;
      if (nextBtn) nextBtn.disabled = (!this.hasMoreContent && this.currentPage === this.storyHistory.length) || this.isGenerating;
    }
  }

  async navigatePage(direction) {
    if (this.isGenerating) return;

    if (direction === 'prev') {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.saveToStorage();
        await this.displayCurrentPage();
      }
    } else if (direction === 'next') {
      if (this.currentPage < this.storyHistory.length) {
        this.currentPage++;
        this.saveToStorage();
        await this.displayCurrentPage();
      } else if (this.hasMoreContent) {
        this.currentPage++;
        await this.generatePage();
      } else {
        console.log("Already at the end of the story.");
        const nextBtn = document.getElementById('nextPage');
        if (nextBtn) nextBtn.disabled = true;
      }
    }
  }

  resetForm() {
    const formElement = document.getElementById('storyFormElement');
    if (formElement) formElement.reset();
    this.currentPage = 1;
    this.storyData = null;
    this.storyHistory = [];
    this.hasMoreContent = true;
    this.isGenerating = false;
    const contentElement = document.getElementById('storyContent');
    if (contentElement) contentElement.innerHTML = '';
    const pageNumEl = document.getElementById('pageNumber');
    if (pageNumEl) pageNumEl.textContent = 'Page 1';
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
    this.hasMoreContent = true;
    this.isGenerating = false;

    this.displayCurrentPage();
    if (this.currentPage === this.storyHistory.length) {
      const nextBtn = document.getElementById('nextPage');
      if (nextBtn) {
        nextBtn.disabled = !this.hasMoreContent || this.isGenerating;
      }
    }
  }

  saveToStorage() {
    if (this.storyData && this.storyManager.currentStoryId) {
      this.storyManager.saveStory(this.storyData, this.currentPage, this.storyHistory);
    } else if (this.storyData) {
      this.storyManager.saveStory(this.storyData, this.currentPage, this.storyHistory);
    }
  }
}