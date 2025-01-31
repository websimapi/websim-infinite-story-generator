const { jsPDF } = window.jspdf;

class StoryManager {
  constructor() {
    this.stories = new Map();
    this.currentStoryId = null;
    this.storyGenerator = null;
    this.speaking = false;
    this.speechSynthesis = window.speechSynthesis;
    this.speechQueue = [];
    this.currentSpeaker = null;
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
    document.getElementById('ttsButton').addEventListener('click', () => this.toggleTTS());
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
      
      const titleSection = document.createElement('div');
      titleSection.className = 'story-title';
      
      const renderTitleView = () => {
        titleSection.innerHTML = `
          <h3>${story.title || `${story.storyData.storyType} Story`}</h3>
          <button class="edit-title-btn" aria-label="Edit title">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
        `;

        const editButton = titleSection.querySelector('.edit-title-btn');
        editButton.addEventListener('click', renderTitleEdit);
      };

      const renderTitleEdit = () => {
        const currentTitle = story.title || `${story.storyData.storyType} Story`;
        titleSection.innerHTML = `
          <input type="text" class="edit-title-input" value="${currentTitle}">
          <button class="save-title-btn">Save</button>
        `;

        const input = titleSection.querySelector('.edit-title-input');
        const saveButton = titleSection.querySelector('.save-title-btn');

        input.focus();
        input.select();

        const saveTitle = () => {
          const newTitle = input.value.trim();
          if (newTitle) {
            story.title = newTitle;
            this.saveStories();
            renderTitleView();
          }
        };

        saveButton.addEventListener('click', saveTitle);
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            saveTitle();
          }
        });
      };

      renderTitleView();
      storyCard.appendChild(titleSection);
      
      // Add the rest of the card content
      storyCard.innerHTML += `
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
        <h2>${story.title || `${story.storyData.storyType} Story`}</h2>
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
    const existingStory = this.stories.get(id);
    this.stories.set(id, {
      id,
      title: existingStory?.title || `${storyData.storyType} Story`,
      storyData,
      currentPage,
      storyHistory
    });
    this.currentStoryId = id;
    this.saveStories();
  }

  editStoryTitle(id, newTitle) {
    const story = this.stories.get(id);
    if (story) {
      story.title = newTitle;  
      this.saveStories();
      this.renderStoryList();
    }
  }

  async downloadPDF() {
    if (!this.currentStoryId) return;
    
    const story = this.stories.get(this.currentStoryId);
    if (!story) return;

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
    const bottomMargin = 30; // Increased bottom margin
    const textWidth = pageWidth - (2 * margin);

    // Start with a larger base font size
    pdf.setFontSize(12);

    for (let i = 0; i < story.storyHistory.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      const cacheKey = `${this.currentStoryId}_page_${i + 1}`;
      const imageUrl = this.storyGenerator?.imageCache.get(cacheKey);

      let currentY = margin;

      if (imageUrl) {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
              try {
                const imgWidth = pageWidth - (2 * margin);
                const imgHeight = (img.height * imgWidth) / img.width;
                
                const maxImgHeight = pageHeight/2; 
                const finalImgHeight = Math.min(imgHeight, maxImgHeight);
                
                canvas.width = img.width;
                canvas.height = img.height;
                
                ctx.drawImage(img, 0, 0, img.width, img.height);
                
                const canvasDataUrl = canvas.toDataURL('image/jpeg', 1.0);
                
                pdf.addImage(
                  canvasDataUrl,
                  'JPEG',
                  margin,
                  currentY,
                  imgWidth,
                  finalImgHeight
                );
                
                currentY += finalImgHeight + 10;
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
        }
      }

      const text = story.storyHistory[i];
      
      // Calculate available height for text, accounting for increased bottom margin
      const availableHeight = pageHeight - currentY - bottomMargin;
      
      // Split text to find optimal font size
      let fontSize = 12; // Start with larger font size
      let textLines;
      let textHeight;
      
      do {
        pdf.setFontSize(fontSize);
        textLines = pdf.splitTextToSize(text, textWidth);
        textHeight = (textLines.length * fontSize * 0.3527777778); // Convert pt to mm
        
        if (textHeight > availableHeight) {
          fontSize--;
        }
      } while (textHeight > availableHeight && fontSize > 8); // Don't go smaller than 8pt
      
      // If text still doesn't fit, create new pages as needed
      if (textHeight > availableHeight) {
        let remainingLines = [...textLines];
        let currentPage = 0;
        
        while (remainingLines.length > 0) {
          if (currentPage > 0) {
            pdf.addPage();
            currentY = margin;
          }
          
          // Calculate how many lines can fit on current page
          const linesPerPage = Math.floor((pageHeight - currentY - bottomMargin) / (fontSize * 0.3527777778));
          const currentPageLines = remainingLines.slice(0, linesPerPage);
          remainingLines = remainingLines.slice(linesPerPage);
          
          pdf.text(currentPageLines, margin, currentY);
          currentPage++;
        }
      } else {
        // All text fits on one page
        pdf.text(textLines, margin, currentY);
      }
    }

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

  async toggleTTS() {
    if (this.speaking) {
      this.speechSynthesis.cancel();
      this.speaking = false;
      document.getElementById('ttsButton').textContent = 'Read Aloud';
      this.speechQueue = [];
    } else {
      const story = this.stories.get(this.currentStoryId);
      if (!story) return;

      const currentText = story.storyHistory[story.currentPage - 1];
      
      // Split text into segments that preserve quotes
      const segments = currentText.match(/("[^"]+"|[^"]+)/g) || [currentText];
      
      // Process each segment
      this.speechQueue = segments.map(segment => {
        const utterance = new SpeechSynthesisUtterance(segment.trim());
        
        // Check if this is a quoted speech
        if (segment.startsWith('"') && segment.endsWith('"')) {
          const dialogueContext = this.getDialogueContext(segment, currentText);
          const gender = this.determineSpeakerGender(dialogueContext);
          
          if (gender) {
            // Get available voices
            const voices = this.speechSynthesis.getVoices();
            
            // Filter and select appropriate voice based on gender
            const genderVoices = voices.filter(voice => {
              const voiceName = voice.name.toLowerCase();
              return gender === 'female' ? 
                voiceName.includes('female') || voiceName.includes('woman') :
                voiceName.includes('male') || voiceName.includes('man');
            });
            
            if (genderVoices.length > 0) {
              utterance.voice = genderVoices[0];
              utterance.pitch = gender === 'female' ? 1.2 : 0.8;
            }
          }
        }
        
        return utterance;
      });

      this.speaking = true;
      document.getElementById('ttsButton').textContent = 'Stop Reading';
      this.speakNextInQueue();
    }
  }

  getDialogueContext(dialogueSegment, fullText) {
    // Get the text before and after the dialogue
    const dialogueIndex = fullText.indexOf(dialogueSegment);
    const contextWindow = 100; // Look at 100 characters before and after
    
    const context = {
      before: fullText.substring(Math.max(0, dialogueIndex - contextWindow), dialogueIndex),
      current: dialogueSegment,
      after: fullText.substring(
        dialogueIndex + dialogueSegment.length, 
        Math.min(fullText.length, dialogueIndex + dialogueSegment.length + contextWindow)
      )
    };
    return context;
  }

  determineSpeakerGender(context) {
    const genderIndicators = {
      female: ['she', 'her', 'herself', 'woman', 'girl', 'mother', 'sister', 'daughter', 'aunt', 'lady'],
      male: ['he', 'him', 'himself', 'man', 'boy', 'father', 'brother', 'son', 'uncle', 'gentleman']
    };

    const contextText = context.before + ' ' + context.after;
    const words = contextText.toLowerCase().split(/\W+/);
    
    let femaleScore = 0;
    let maleScore = 0;

    // Check for immediate gender indicators in nearby context
    words.forEach(word => {
      if (genderIndicators.female.includes(word)) femaleScore++;
      if (genderIndicators.male.includes(word)) maleScore++;
    });

    // Add weighting for proximity to dialogue
    const nearbyWords = contextText.split(/\W+/).slice(-3).concat(
      contextText.split(/\W+/).slice(0, 3)
    );
    
    nearbyWords.forEach(word => {
      if (genderIndicators.female.includes(word.toLowerCase())) femaleScore += 2;
      if (genderIndicators.male.includes(word.toLowerCase())) maleScore += 2;
    });

    if (femaleScore > maleScore) return 'female';
    if (maleScore > femaleScore) return 'male';
    return null;
  }

  speakNextInQueue() {
    if (!this.speaking || this.speechQueue.length === 0) {
      this.speaking = false;
      document.getElementById('ttsButton').textContent = 'Read Aloud';
      return;
    }

    const utterance = this.speechQueue.shift();
    utterance.onend = () => {
      if (this.speaking) {
        this.speakNextInQueue();
      }
    };

    try {
      this.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Error speaking:', error);
      this.speaking = false;
      document.getElementById('ttsButton').textContent = 'Read Aloud';
    }
  }

  // ...rest of the class methods...
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
    
    if (this.imageCache.has(cacheKey)) {
      return this.createCachedImageElement(cacheKey);
    }

    const img = document.createElement('img');
    img.id = `page_${pageId}_image`;
    img.style.display = 'none';
    img.alt = pageContent;
    img.src = pageContent;

    img.addEventListener('load', () => {
      if (img.src !== pageContent) {
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
    
    contentElement.innerHTML = '';
    
    const imageElement = await this.generatePageImage(currentContent, this.currentPage);
    contentElement.appendChild(imageElement);
    
    const textDiv = document.createElement('div');
    textDiv.className = 'story-text';
    textDiv.textContent = currentContent; 
    contentElement.appendChild(textDiv);
    
    document.getElementById('pageNumber').textContent = `Page ${this.currentPage}`;
    
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
    
    document.getElementById('storyForm').style.display = 'none';
    document.getElementById('storyContainer').classList.remove('hidden');
    
    await this.generatePage();
  }

  async generatePage() {
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

const storyManager = new StoryManager();