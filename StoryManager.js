import { StoryGenerator } from './StoryGenerator.js';
const { jsPDF } = window.jspdf;

export class StoryManager {
  constructor() {
    this.stories = new Map();
    this.currentStoryId = null;
    this.storyGenerator = null;
    this.loadStories();
    this.setupGlobalEventListener();
    this.showStoryList();
    this.updatePDFButtonState();
  }

  setupGlobalEventListener() {
    document.body.addEventListener('click', (event) => {
      const target = event.target;

      const createNewBtn = target.closest('#createNewStory');
      if (createNewBtn) {
        this.startNewStory();
        return;
      }

      const continueBtn = target.closest('.continue-btn');
      if (continueBtn && continueBtn.dataset.id) {
        event.stopPropagation();
        this.continueStory(continueBtn.dataset.id);
        return;
      }

      const viewDetailsBtn = target.closest('.view-details-btn');
      if (viewDetailsBtn && viewDetailsBtn.dataset.id) {
        event.stopPropagation();
        this.viewStoryDetails(viewDetailsBtn.dataset.id);
        return;
      }

      const deleteBtn = target.closest('.delete-btn');
      if (deleteBtn && deleteBtn.dataset.id) {
        event.stopPropagation();
        this.deleteStory(deleteBtn.dataset.id);
        return;
      }

      const storyCard = target.closest('.story-card:not(.editing)');
      if (storyCard && !continueBtn && !viewDetailsBtn && !deleteBtn && !target.closest('.edit-title-btn') && !target.closest('.save-title-btn') && !target.closest('.edit-title-input')) {
        const id = storyCard.querySelector('.continue-btn')?.dataset.id;
        if (id) {
          this.continueStory(id);
        }
        return;
      }

      const editTitleBtn = target.closest('.edit-title-btn');
      if (editTitleBtn) {
        event.stopPropagation();
        const storyCard = editTitleBtn.closest('.story-card');
        const id = storyCard?.querySelector('[data-id]')?.dataset.id;
        if (storyCard && id) {
          this.toggleTitleEdit(storyCard, id, true);
        }
        return;
      }

      const saveTitleBtn = target.closest('.save-title-btn');
      if (saveTitleBtn) {
        event.stopPropagation();
        const storyCard = saveTitleBtn.closest('.story-card');
        const id = storyCard?.querySelector('[data-id]')?.dataset.id;
        if (storyCard && id) {
          this.saveEditedTitle(storyCard, id);
        }
        return;
      }

      const homeIcon = target.closest('#homeIcon');
      if (homeIcon) {
        this.showStoryList();
        return;
      }

      const pdfIcon = target.closest('#pdfIcon:not(.disabled)');
      if (pdfIcon) {
        this.downloadPDF();
        return;
      }

      const generateBtn = target.closest('#generateBtn');
      if (generateBtn) {
        if (this.storyGenerator) {
          this.storyGenerator.startGeneratingNewStory();
        } else {
          console.error("Story Generator not initialized!");
          this.storyGenerator = new StoryGenerator(this);
          this.storyGenerator.startGeneratingNewStory();
        }
        return;
      }

      const prevPageBtn = target.closest('#prevPage');
      if (prevPageBtn && !prevPageBtn.disabled) {
        if (this.storyGenerator) this.storyGenerator.navigatePage('prev');
        return;
      }

      const nextPageBtn = target.closest('#nextPage');
      if (nextPageBtn && !nextPageBtn.disabled) {
        if (this.storyGenerator) this.storyGenerator.navigatePage('next');
        return;
      }
    });

    document.body.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        const input = event.target.closest('.edit-title-input');
        if (input) {
          event.preventDefault();
          event.stopPropagation();
          const storyCard = input.closest('.story-card');
          const id = storyCard?.querySelector('[data-id]')?.dataset.id;
          if (storyCard && id) {
            this.saveEditedTitle(storyCard, id);
          }
        }
      }
    });

    document.body.addEventListener('focusout', (event) => {
      const input = event.relatedTarget?.closest('.edit-title-input') ?? null;
      const currentInput = event.target.closest('.edit-title-input');

      if (currentInput && !event.relatedTarget?.closest('.story-title')) {
        const storyCard = currentInput.closest('.story-card');
        const id = storyCard?.querySelector('[data-id]')?.dataset.id;
        if (storyCard && id) {
          const story = this.stories.get(id);
          if (story) {
            this.renderSingleStoryCard(story, storyCard);
          } else {
            this.renderStoryList();
          }
        }
      }
    });
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
      const storyCard = this.createStoryCardElement(story);
      savedStoriesEl.appendChild(storyCard);
    });
  }

  createStoryCardElement(story) {
    const id = story.id;
    const storyCard = document.createElement('div');
    storyCard.className = 'story-card';
    storyCard.dataset.storyId = id;

    storyCard.innerHTML = `
      <div class="story-title">
        <h3>${story.title || `${story.storyData.storyType} Story`}</h3>
        <button class="edit-title-btn" title="Edit title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        </button>
      </div>
      <p>Genre: ${story.storyData.storyType} | Tone: ${story.storyData.narrativeTone}</p>
      <p>Pages: ${story.storyHistory.length}</p>
      <div class="story-card-actions">
        <button class="story-card-btn continue-btn" data-id="${id}">Continue</button>
        <button class="story-card-btn view-details-btn" data-id="${id}">View Details</button>
        <button class="story-card-btn delete-btn" data-id="${id}">Delete</button>
      </div>
    `;
    return storyCard;
  }

  renderSingleStoryCard(story, existingCardElement) {
    const newCard = this.createStoryCardElement(story);
    existingCardElement.replaceWith(newCard);
  }

  toggleTitleEdit(storyCardElement, storyId, startEditing) {
    const titleSection = storyCardElement.querySelector('.story-title');
    if (!titleSection) return;

    const story = this.stories.get(storyId);
    if (!story) return;

    storyCardElement.classList.toggle('editing', startEditing);

    if (startEditing) {
      const currentTitle = story.title || `${story.storyData.storyType} Story`;
      titleSection.innerHTML = `
        <input type="text" class="edit-title-input" value="${currentTitle}" data-original-title="${currentTitle}">
        <button class="btn btn-secondary save-title-btn">Save</button>
      `;

      const input = titleSection.querySelector('.edit-title-input');
      setTimeout(() => {
        input?.focus();
        input?.select();
      }, 0);
    } else {
      titleSection.innerHTML = `
        <h3>${story.title || `${story.storyData.storyType} Story`}</h3>
        <button class="edit-title-btn" title="Edit title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        </button>
      `;
    }
  }

  saveEditedTitle(storyCardElement, storyId) {
    const input = storyCardElement.querySelector('.edit-title-input');
    if (!input) return;

    const newTitle = input.value.trim();
    if (newTitle) {
      this.editStoryTitle(storyId, newTitle);
      this.toggleTitleEdit(storyCardElement, storyId, false);
    } else {
      const originalTitle = input.dataset.originalTitle || '';
      this.editStoryTitle(storyId, originalTitle);
      this.toggleTitleEdit(storyCardElement, storyId, false);
    }
  }

  startNewStory() {
    this.currentStoryId = null;
    const storyList = document.getElementById('storyList');
    const storyForm = document.getElementById('storyForm');
    const storyContainer = document.getElementById('storyContainer');

    if (storyList) storyList.classList.add('hidden');
    if (storyForm) {
      storyForm.classList.remove('hidden');
      storyForm.querySelector('form')?.reset();
    }
    if (storyContainer) storyContainer.classList.add('hidden');

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

    document.getElementById('storyList').classList.add('hidden');
    document.getElementById('storyForm').classList.add('hidden');
    document.getElementById('storyContainer').classList.remove('hidden');

    this.storyGenerator.loadStory(story);
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
          for (let i = 0; i < story.storyHistory.length; i++) {
            const cacheKey = `${id}_page_${i + 1}`;
            this.storyGenerator.imageCache.delete(cacheKey);
          }
          this.storyGenerator.saveImageCache();
        }
      }

      this.stories.delete(id);
      this.saveStories();
      const cardToRemove = document.querySelector(`.story-card[data-story-id="${id}"]`);
      if (cardToRemove) {
        cardToRemove.remove();
        if (this.stories.size === 0) {
          this.renderStoryList();
        }
      } else {
        this.renderStoryList();
      }

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
          if (imgData) {
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
          console.error(`Error adding image for page ${i + 1} to PDF:`, error);
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
      pdf.text(`Page ${i + 1}`, pageWidth / 2, pageHeight - bottomMargin + 10, { align: 'center' });
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
}