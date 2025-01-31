const { jsPDF } = window.jspdf;

class StoryManager {
  constructor() {
    this.stories = new Map();
    this.currentStoryId = null;
    this.storyGenerator = null;
    this.loadStories();
    this.setupEventListeners();
    this.showStoryList();
    // Add home icon click handler
    document.getElementById('homeIcon').addEventListener('click', () => this.showStoryList());
    document.getElementById('pdfIcon').addEventListener('click', () => this.downloadPDF());
    this.updatePDFButtonState();
  }

  setupEventListeners() {
    document.getElementById('createNewStory').addEventListener('click', () => this.startNewStory());
  }

  loadStories() {
    try {
      const savedStories = localStorage.getItem('stories');
      if (savedStories) {
        const storiesArray = JSON.parse(savedStories);
        storiesArray.forEach(story => {
          this.stories.set(story.id, story);
        });
      }
    } catch (error) {
      console.error('Error loading stories:', error);
    }
  }

  saveStories() {
    try {
      const storiesArray = Array.from(this.stories.values());
      localStorage.setItem('stories', JSON.stringify(storiesArray));
    } catch (error) {
      console.error('Error saving stories:', error);
    }
  }

  showStoryList() {
    document.getElementById('storyList').classList.remove('hidden');
    document.getElementById('storyForm').classList.add('hidden');
    document.getElementById('storyContainer').classList.add('hidden');
    
    this.renderStoryList();
  }

  renderStoryList() {
    const savedStoriesEl = document.getElementById('savedStories');
    savedStoriesEl.innerHTML = '';

    if (this.stories.size === 0) {
      savedStoriesEl.innerHTML = `
        <div class="no-stories">
          <p>You haven't created any stories yet.</p>
        </div>
      `;
      return;
    }

    this.stories.forEach((story, id) => {
      const storyCard = document.createElement('div');
      storyCard.className = 'story-card';
      storyCard.innerHTML = `
        <h3>${story.storyData.storyType} Story</h3>
        <p>Genre: ${story.storyData.storyType} | Tone: ${story.storyData.narrativeTone}</p>
        <p>Pages: ${story.storyHistory.length}</p>
        <div class="story-card-actions">
          <button class="story-card-btn continue-btn" data-id="${id}">Continue</button>
          <button class="story-card-btn view-details-btn" data-id="${id}">View Details</button>
          <button class="story-card-btn delete-btn" data-id="${id}">Delete</button>
        </div>
      `;

      storyCard.querySelector('.continue-btn').addEventListener('click', () => this.continueStory(id));
      storyCard.querySelector('.view-details-btn').addEventListener('click', () => this.viewStoryDetails(id));
      storyCard.querySelector('.delete-btn').addEventListener('click', () => this.deleteStory(id));

      savedStoriesEl.appendChild(storyCard);
    });
  }

  startNewStory() {
    this.currentStoryId = null;
    document.getElementById('storyList').classList.add('hidden');
    document.getElementById('storyForm').classList.remove('hidden');
    
    if (!this.storyGenerator) {
      this.storyGenerator = new StoryGenerator(this);
    } else {
      this.storyGenerator.resetForm();
    }
  }

  continueStory(id) {
    const story = this.stories.get(id);
    if (!story) return;

    this.currentStoryId = id;
    if (!this.storyGenerator) {
      this.storyGenerator = new StoryGenerator(this);
    }
    
    this.storyGenerator.loadStory(story);
    document.getElementById('storyList').classList.add('hidden');
  }

  viewStoryDetails(id) {
    const story = this.stories.get(id);
    if (!story) return;

    // Create a modal to display story details
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Story Details</h2>
        <div class="story-details">
          <p><strong>Type:</strong> ${story.storyData.storyType}</p>
          <p><strong>Tone:</strong> ${story.storyData.narrativeTone}</p>
          <p><strong>Length:</strong> ${story.storyData.storyLength}</p>
          <p><strong>POV:</strong> ${story.storyData.pov}</p>
          <p><strong>Structure:</strong> ${story.storyData.structure}</p>
          <p><strong>Target Age:</strong> ${story.storyData.targetAge}</p>
        </div>
        <button class="modal-close">Close</button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  }

  deleteStory(id) {
    if (confirm('Are you sure you want to delete this story?')) {
      this.stories.delete(id);
      this.saveStories();
      this.renderStoryList();
    }
  }

  saveStory(storyData, currentPage, storyHistory) {
    const id = this.currentStoryId || Date.now().toString();
    this.stories.set(id, {
      id,
      storyData,
      currentPage,
      storyHistory
    });
    this.currentStoryId = id;
    this.saveStories();
  }

  async downloadPDF() {
    if (!this.currentStoryId) return;
    
    const story = this.stories.get(this.currentStoryId);
    if (!story) return;

    // Ensure jsPDF is properly loaded
    if (typeof window.jspdf === 'undefined') {
      console.error('jsPDF library not loaded');
      return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const textWidth = pageWidth - (2 * margin);

    for (let i = 0; i < story.storyHistory.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      // Get the cached image URL
      const cacheKey = `${this.currentStoryId}_page_${i + 1}`;
      const imageUrl = this.storyGenerator?.imageCache.get(cacheKey);

      if (imageUrl) {
        try {
          // Create canvas and draw image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Convert data URL to image for PDF
          await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";  // Handle CORS
            img.onload = () => {
              try {
                // Set canvas size to match image aspect ratio
                const imgWidth = pageWidth - (2 * margin);
                const imgHeight = (img.height * imgWidth) / img.width;
                
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw image to canvas
                ctx.drawImage(img, 0, 0, img.width, img.height);
                
                // Get canvas data URL
                const canvasDataUrl = canvas.toDataURL('image/jpeg', 1.0);
                
                // Add image to PDF
                pdf.addImage(
                  canvasDataUrl,
                  'JPEG',
                  margin,
                  margin,
                  imgWidth,
                  imgHeight
                );
                
                // Add text below image
                const textY = margin + imgHeight + 10;
                const text = story.storyHistory[i];
                const splitText = pdf.splitTextToSize(text, textWidth);
                pdf.setFontSize(12);
                pdf.text(splitText, margin, textY);
                
                // Clean up
                canvas.remove();
                resolve();
              } catch (e) {
                reject(e);
              }
            };
            img.onerror = reject;
            img.src = imageUrl;
          });
        } catch (error) {
          console.error('Error adding image to PDF:', error);
          // Continue with next page even if image fails
          const text = story.storyHistory[i];
          const splitText = pdf.splitTextToSize(text, textWidth);
          pdf.setFontSize(12);
          pdf.text(splitText, margin, margin);
        }
      } else {
        // If no image, just add text
        const text = story.storyHistory[i];
        const splitText = pdf.splitTextToSize(text, textWidth);
        pdf.setFontSize(12);
        pdf.text(splitText, margin, margin);
      }
    }

    // Save the PDF
    pdf.save(`story_${this.currentStoryId}.pdf`);
  }

  updatePDFButtonState() {
    const pdfIcon = document.getElementById('pdfIcon');
    if (this.currentStoryId && this.stories.get(this.currentStoryId)?.storyHistory.length > 0) {
      pdfIcon.classList.remove('disabled');
    } else {
      pdfIcon.classList.add('disabled');
    }
  }
}

class StoryGenerator {
  constructor(storyManager) {
    this.storyManager = storyManager;
    this.currentPage = 1;
    this.storyData = null;
    this.storyHistory = [];
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
      localStorage.setItem('storyImageCache', JSON.stringify([...this.imageCache]));
    } catch (error) {
      console.error('Error saving image cache:', error);
    }
  }

  async generatePageImage(pageContent, pageId) {
    const cacheKey = `${this.storyManager.currentStoryId}_page_${pageId}`;
    
    // Check if we have a cached image URL
    if (this.imageCache.has(cacheKey)) {
      return this.createCachedImageElement(cacheKey);
    }

    // Create new image element for generation
    const img = document.createElement('img');
    img.id = `page_${pageId}_image`;
    img.style.display = 'none';
    img.alt = pageContent;
    img.src = pageContent;

    // Listen for the image src change (this indicates Dall-E or similar has generated the image)
    img.addEventListener('load', () => {
      if (img.src !== pageContent) {
        // Image has been generated
        this.imageCache.set(cacheKey, img.src);
        this.saveImageCache();
        img.style.display = 'block';
      }
    });

    return img;
  }

  createCachedImageElement(cacheKey) {
    const div = document.createElement('div');
    div.className = 'story-page-image';
    div.style.backgroundImage = `url(${this.imageCache.get(cacheKey)})`;
    return div;
  }

  async displayCurrentPage(hasMoreContent = true) {
    const currentContent = this.storyHistory[this.currentPage - 1];
    const contentElement = document.getElementById('storyContent');
    
    // Clear previous content
    contentElement.innerHTML = '';
    
    // Generate or retrieve image FIRST
    const imageElement = await this.generatePageImage(currentContent, this.currentPage);
    contentElement.appendChild(imageElement);
    
    // Create text content SECOND
    const textDiv = document.createElement('div');
    textDiv.className = 'story-text';
    textDiv.innerHTML = currentContent;
    contentElement.appendChild(textDiv);
    
    document.getElementById('pageNumber').textContent = `Page ${this.currentPage}`;
    
    // Update navigation buttons
    document.getElementById('prevPage').disabled = this.currentPage === 1;
    document.getElementById('nextPage').disabled = !hasMoreContent;
    
    this.storyManager.updatePDFButtonState();
  }

  setupEventListeners() {
    document.getElementById('generateBtn').addEventListener('click', () => this.generateStory());
    document.getElementById('prevPage').addEventListener('click', () => this.navigatePage('prev'));
    document.getElementById('nextPage').addEventListener('click', () => this.navigatePage('next'));
    document.getElementById('newStory').addEventListener('click', () => this.resetForm());
  }

  loadFromStorage() {
    try {
      const savedState = localStorage.getItem('storyState');
      if (savedState) {
        const state = JSON.parse(savedState);
        this.currentPage = state.currentPage;
        this.storyData = state.storyData;
        this.storyHistory = state.storyHistory;

        // If we have saved data, show the story container and hide the form
        if (this.storyData) {
          document.getElementById('storyForm').style.display = 'none';
          document.getElementById('storyContainer').classList.remove('hidden');
          this.displayCurrentPage();
        }
      }
    } catch (error) {
      console.error('Error loading from storage:', error);
      this.resetForm();
    }
  }

  saveToStorage() {
    this.storyManager.saveStory(this.storyData, this.currentPage, this.storyHistory);
  }

  async generateStory() {
    const formData = this.collectFormData();
    if (!this.validateForm(formData)) {
      alert('Please fill out all required fields!');
      return;
    }

    this.storyData = formData;
    this.currentPage = 1;
    this.storyHistory = [];
    this.saveToStorage();
    
    // Show story container and hide form
    document.getElementById('storyForm').style.display = 'none';
    document.getElementById('storyContainer').classList.remove('hidden');
    
    await this.generatePage();
  }

  async generatePage() {
    // If we already have this page in history, just display it
    if (this.storyHistory[this.currentPage - 1]) {
      this.displayCurrentPage();
      return;
    }

    const loadingText = 'Generating your story...';
    document.getElementById('storyContent').textContent = loadingText;

    try {
      const response = await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Generate page ${this.currentPage} of a story based on the following parameters. Make it engaging and coherent with any previous content. Keep each page around 500 words.
          
          interface Response {
            content: string;
            hasMoreContent: boolean;
          }

          {
            "content": "The sun cast long shadows across the desert landscape as Sarah adjusted her protective gear...",
            "hasMoreContent": true
          }
          `,
          data: {
            storyParameters: this.storyData,
            currentPage: this.currentPage,
            previousPages: this.storyHistory
          }
        })
      });

      const data = await response.json();
      
      // Store the current page in history
      this.storyHistory[this.currentPage - 1] = data.content;
      this.saveToStorage();
      
      this.displayCurrentPage(data.hasMoreContent);
    } catch (error) {
      console.error('Error generating story:', error);
      document.getElementById('storyContent').textContent = 'An error occurred while generating the story. Please try again.';
    }
  }

  async navigatePage(direction) {
    if (direction === 'prev' && this.currentPage > 1) {
      this.currentPage--;
      this.saveToStorage();
      this.displayCurrentPage();
    } else if (direction === 'next') {
      this.currentPage++;
      this.saveToStorage();
      await this.generatePage();
    }
  }

  resetForm() {
    const formElement = document.getElementById('storyFormElement');
    formElement.reset();
    document.getElementById('storyForm').style.display = 'block';
    document.getElementById('storyContainer').classList.add('hidden');
    
    this.currentPage = 1;
    this.storyData = null;
    this.storyHistory = [];
  }

  collectFormData() {
    const formData = {};
    const inputs = document.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      if (input.id) {
        formData[input.id] = input.value.trim();
      }
    });
    
    return formData;
  }

  validateForm(formData) {
    // Check required fields
    const requiredFields = ['storyType', 'narrativeTone', 'storyLength', 'pov', 'structure', 'targetAge'];
    return requiredFields.every(field => formData[field] && formData[field].length > 0);
  }

  loadStory(story) {
    this.currentPage = story.currentPage;
    this.storyData = story.storyData;
    this.storyHistory = story.storyHistory;

    document.getElementById('storyForm').style.display = 'none';
    document.getElementById('storyContainer').classList.remove('hidden');
    this.displayCurrentPage();
  }
}

// Initialize the story manager
const storyManager = new StoryManager();