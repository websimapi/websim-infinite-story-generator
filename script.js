class StoryGenerator {
  constructor() {
    this.currentPage = 1;
    this.storyData = null;
    this.storyHistory = [];
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('generateBtn').addEventListener('click', () => this.generateStory());
    document.getElementById('prevPage').addEventListener('click', () => this.navigatePage('prev'));
    document.getElementById('nextPage').addEventListener('click', () => this.navigatePage('next'));
    document.getElementById('newStory').addEventListener('click', () => this.resetForm());
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
    
    // Show story container and hide form
    document.getElementById('storyForm').style.display = 'none';
    document.getElementById('storyContainer').classList.remove('hidden');
    
    await this.generatePage();
  }

  async generatePage() {
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
      this.storyHistory.push(data.content);
      
      // Update the story display
      document.getElementById('storyContent').innerHTML = data.content;
      document.getElementById('pageNumber').textContent = `Page ${this.currentPage}`;
      
      // Update navigation buttons
      document.getElementById('prevPage').disabled = this.currentPage === 1;
      document.getElementById('nextPage').disabled = !data.hasMoreContent;
    } catch (error) {
      console.error('Error generating story:', error);
      document.getElementById('storyContent').textContent = 'An error occurred while generating the story. Please try again.';
    }
  }

  async navigatePage(direction) {
    if (direction === 'prev' && this.currentPage > 1) {
      this.currentPage--;
    } else if (direction === 'next') {
      this.currentPage++;
    }
    
    await this.generatePage();
  }

  resetForm() {
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