import { StoryGenerator } from './StoryGenerator.js';
const { jsPDF } = window.jspdf;

export class StoryManager {
  constructor() {
    this.stories = new Map();
    this.currentStoryId = null;
    this.storyGenerator = null; 
    this.loadStories();
    this.setupEventListeners();
    this.showStoryList();
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
    this.currentStoryId = null; 
    this.updatePDFButtonState(); 
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

    const sortedStories = Array.from(this.stories.values()).sort((a, b) => parseInt(b.id) - parseInt(a.id));

    sortedStories.forEach((story) => {
      const id = story.id;
      const storyCard = document.createElement('div');
      storyCard.className = 'story-card';

      const titleSection = document.createElement('div');
      titleSection.className = 'story-title';
      titleSection.innerHTML = `
        <h3>${story.title || `${story.storyData.storyType} Story`}</h3>
        <button class="edit-title-btn" title="Edit title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        </button>
      `;

      const titleElement = titleSection.querySelector('h3');
      const editButton = titleSection.querySelector('.edit-title-btn');

      editButton.addEventListener('click', (event) => {
        event.stopPropagation(); 
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
            this.editStoryTitle(id, newTitle);
            titleSection.innerHTML = `
              <h3>${newTitle}</h3>
              <button class="edit-title-btn" title="Edit title">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
            `;
            titleSection.querySelector('.edit-title-btn').addEventListener('click', (e) => {
              e.stopPropagation();
              saveButton.click(); 
            });

          } else {
            this.renderStoryList(); 
          }
        };

        saveButton.addEventListener('click', (e) => {
          e.stopPropagation();
          saveTitle();
        });
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.stopPropagation();
            saveTitle();
          }
        });
        input.addEventListener('blur', (e) => {
          this.renderStoryList(); 
        });
      });

      storyCard.appendChild(titleSection);

      storyCard.innerHTML += `
        <p>Genre: ${story.storyData.storyType} | Tone: ${story.storyData.narrativeTone}</p>
        <p>Pages: ${story.storyHistory.length}</p>
        <div class="story-card-actions">
          <button class="story-card-btn continue-btn" data-id="${id}">Continue</button>
          <button class="story-card-btn view-details-btn" data-id="${id}">View Details</button>
          <button class="story-card-btn delete-btn" data-id="${id}">Delete</button>
        </div>
      `;

      storyCard.querySelector('.continue-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.continueStory(e.target.dataset.id)
      });
      storyCard.querySelector('.view-details-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.viewStoryDetails(e.target.dataset.id)
      });
      storyCard.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteStory(e.target.dataset.id)
      });

      storyCard.addEventListener('click', () => this.continueStory(id));

      savedStoriesEl.appendChild(storyCard);
    });
  }

  startNewStory() {
    this.currentStoryId = null;
    document.getElementById('storyList').classList.add('hidden');
    document.getElementById('storyForm').classList.remove('hidden');
    document.getElementById('storyContainer').classList.add('hidden');

    if (!this.storyGenerator) {
      this.storyGenerator = new StoryGenerator(this);
    } else {
      this.storyGenerator.resetForm();
    }
    this.updatePDFButtonState();
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
    document.getElementById('storyForm').classList.add('hidden');
    document.getElementById('storyContainer').classList.remove('hidden');
    this.updatePDFButtonState();
  }

  viewStoryDetails(id) {
    const story = this.stories.get(id);
    if (!story) return;

    const details = `
      Title: ${story.title || `${story.storyData.storyType} Story`}
      Type: ${story.storyData.storyType}
      Tone: ${story.storyData.narrativeTone}
      Length: ${story.storyData.storyLength}
      POV: ${story.storyData.pov}
      Structure: ${story.storyData.structure}
      Target Age: ${story.storyData.targetAge}
      Pages: ${story.storyHistory.length}
    `;
    alert(`Story Details:\n------------------\n${details}`);
  }

  deleteStory(id) {
    if (confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
      if (this.storyGenerator) {
        const story = this.stories.get(id);
        if (story) {
          for(let i = 0; i < story.storyHistory.length; i++) {
            const cacheKey = `${id}_page_${i + 1}`;
            this.storyGenerator.imageCache.delete(cacheKey);
          }
          this.storyGenerator.saveImageCache();
        }
      }

      this.stories.delete(id);
      this.saveStories();
      this.renderStoryList(); 

      if (this.currentStoryId === id) {
        this.showStoryList();
      }
    }
  }

  saveStory(storyData, currentPage, storyHistory, title) {
    const id = this.currentStoryId || Date.now().toString();
    const defaultTitle = storyData ? `${storyData.storyType} Story` : 'New Story';
    this.stories.set(id, {
      id,
      title: title || this.stories.get(id)?.title || defaultTitle, 
      storyData,
      currentPage,
      storyHistory
    });
    this.currentStoryId = id;
    this.saveStories();
    this.updatePDFButtonState(); 
  }

  editStoryTitle(id, newTitle) {
    const story = this.stories.get(id);
    if (story) {
      story.title = newTitle;
      this.saveStories();
    }
  }

  async downloadPDF() {
    if (!this.currentStoryId) {
      alert("Please select or continue a story first.");
      return;
    }

    const story = this.stories.get(this.currentStoryId);
    if (!story || story.storyHistory.length === 0) {
      alert("The selected story has no content to download.");
      return;
    }

    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
      console.error('jsPDF library not loaded correctly.');
      alert('Error: PDF generation library not found.');
      return;
    }
    if (!this.storyGenerator) {
      this.storyGenerator = new StoryGenerator(this);
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15; 
    const bottomMargin = 25; 
    const textWidth = pageWidth - (2 * margin);
    const imgMaxHeight = pageHeight / 3; 

    pdf.setFontSize(18);
    pdf.text(story.title || `${story.storyData.storyType} Story`, pageWidth / 2, margin + 10, { align: 'center' });
    pdf.setFontSize(10);
    pdf.text(`Genre: ${story.storyData.storyType} | Tone: ${story.storyData.narrativeTone}`, pageWidth / 2, margin + 20, { align: 'center' });

    for (let i = 0; i < story.storyHistory.length; i++) {
      pdf.addPage();
      let currentY = margin;

      const cacheKey = `${this.currentStoryId}_page_${i + 1}`;
      const imageUrl = this.storyGenerator?.imageCache.get(cacheKey); 

      if (imageUrl) {
        try {
          const imgData = await this.getImageData(imageUrl);
          if(imgData) {
            const imgProps = pdf.getImageProperties(imgData);
            const imgWidth = textWidth; 
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
            const finalImgHeight = Math.min(imgHeight, imgMaxHeight); 

            pdf.addImage(
              imgData,
              'JPEG', 
              margin,
              currentY,
              imgWidth,
              finalImgHeight
            );
            currentY += finalImgHeight + 10; 
          }

        } catch (error) {
          console.error(`Error adding image for page ${i+1} to PDF:`, error);
          pdf.setFontSize(8);
          pdf.setTextColor(150);
          pdf.text('[Image could not be loaded]', margin, currentY);
          pdf.setTextColor(0); 
          currentY += 5; 
        }
      }

      const text = story.storyHistory[i] || "[No text generated for this page]";

      let fontSize = 11; 
      let textLines;
      let textHeight;
      const lineHeightFactor = 1.15; 

      const calculateAvailableHeight = () => pageHeight - currentY - bottomMargin;
      let availableHeight = calculateAvailableHeight();

      while (fontSize >= 8) {
        pdf.setFontSize(fontSize);
        textLines = pdf.splitTextToSize(text, textWidth);
        textHeight = textLines.length * pdf.getLineHeight() / pdf.internal.scaleFactor * lineHeightFactor;

        if (textHeight <= availableHeight) {
          break; 
        }
        fontSize--; 
      }

      if (textHeight > availableHeight) {
        const linesPerPage = Math.floor(availableHeight / (pdf.getLineHeight() / pdf.internal.scaleFactor * lineHeightFactor));
        const currentPageLines = textLines.slice(0, linesPerPage);
        const remainingLines = textLines.slice(linesPerPage);

        pdf.text(currentPageLines, margin, currentY, { lineHeightFactor: lineHeightFactor });
        currentY += currentPageLines.length * pdf.getLineHeight() / pdf.internal.scaleFactor * lineHeightFactor; 

        if (remainingLines.length > 0) {
          console.warn(`Text overflow on page ${i + 1}, adding extra page.`);
          pdf.addPage();
          currentY = margin;
          pdf.setFontSize(fontSize); 
          pdf.text(remainingLines, margin, currentY, { lineHeightFactor: lineHeightFactor });
        }
      } else {
        pdf.text(textLines, margin, currentY, { lineHeightFactor: lineHeightFactor });
      }

      pdf.setFontSize(8);
      pdf.text(`Page ${i + 1}`, pageWidth / 2 , pageHeight - bottomMargin + 10, { align: 'center'});

    }

    try {
      pdf.save(`story_${story.title || this.currentStoryId}.pdf`);
    } catch (e) {
      console.error("Error saving PDF:", e);
      alert("Could not save the PDF. See console for details.");
    }
  }

  async getImageData(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous"; 
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; 
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9); 
          resolve(dataUrl);
        } catch (e) {
          console.error("Canvas conversion failed:", e);
          reject(new Error("Could not process image for PDF."));
        }
      };
      img.onerror = (e) => {
        console.error("Image loading failed:", url, e);
        reject(new Error(`Failed to load image: ${url}`));
      };
      img.src = url;
    });
  }

  updatePDFButtonState() {
    const pdfIcon = document.getElementById('pdfIcon');
    if (this.currentStoryId && this.stories.get(this.currentStoryId)?.storyHistory.length > 0) {
      pdfIcon.classList.remove('disabled');
      pdfIcon.style.cursor = 'pointer';
      pdfIcon.title = "Download Story as PDF";
    } else {
      pdfIcon.classList.add('disabled');
      pdfIcon.style.cursor = 'not-allowed';
      pdfIcon.title = "No story content available to download";
    }
  }
}