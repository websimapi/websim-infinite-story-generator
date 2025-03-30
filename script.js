// Main script to initialize the application
import { StoryManager } from './StoryManager.js';
// StoryGenerator is imported within StoryManager when needed

// Initialize the Story Manager once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const storyManager = new StoryManager();
  // The StoryManager constructor now handles initial setup and rendering
});