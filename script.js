class StoryGenerator {
  constructor() {
    this.currentPage = 1;
    this.storyData = null;
    this.storyHistory = [];
    this.loadFromStorage();
    this.setupEventListeners();
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
    try {
      const state = {
        currentPage: this.currentPage,
        storyData: this.storyData,
        storyHistory: this.storyHistory
      };
      localStorage.setItem('storyState', JSON.stringify(state));
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
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

  displayCurrentPage(hasMoreContent = true) {
    const currentContent = this.storyHistory[this.currentPage - 1];
    document.getElementById('storyContent').innerHTML = currentContent;
    document.getElementById('pageNumber').textContent = `Page ${this.currentPage}`;
    
    // Update navigation buttons
    document.getElementById('prevPage').disabled = this.currentPage === 1;
    document.getElementById('nextPage').disabled = !hasMoreContent;
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
    // Clear storage
    localStorage.removeItem('storyState');
    
    // Reset form and show it again
    document.getElementById('storyForm').reset();
    document.getElementById('storyForm').style.display = 'block';
    document.getElementById('storyContainer').classList.add('hidden');
    
    // Reset state
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
}

// Initialize the story generator
const storyGenerator = new StoryGenerator();