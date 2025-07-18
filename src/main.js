import AIEngine from './core/ai-engine.js';
import MemorySystem from './core/memory.js';
import SandboxSystem from './core/sandbox.js';
import TerminalUI from './ui/terminal.js';
import TwitterIntegration from './integrations/twitter.js';
import dotenv from 'dotenv';

dotenv.config();

class ChatGPTputer {
  constructor() {
    this.ai = new AIEngine();
    this.memory = new MemorySystem();
    this.sandbox = new SandboxSystem();
    this.ui = new TerminalUI();
    this.twitter = new TwitterIntegration();
    
    this.isRunning = false;
    this.sleepInterval = parseInt(process.env.SLEEP_INTERVAL) || 15000; // Much slower - 15 seconds
    this.maxActionsPerCycle = parseInt(process.env.MAX_ACTIONS_PER_CYCLE) || 1; // Only 1 action per cycle
    this.autonomousMode = process.env.AUTONOMOUS_MODE === 'true';
    
    this.setupSignalHandlers();
  }

  setupSignalHandlers() {
    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('uncaughtException', (error) => {
      this.ui.showError(error.message, 'Uncaught Exception');
      this.gracefulShutdown();
    });
  }

  async start() {
    this.ui.clear();
    this.ui.showHeader();
    this.ui.showWakeUp();
    
    // Initialize systems
    await this.initializeSystems();
    
    this.ui.showHelp();
    this.isRunning = true;
    
    // Start the autonomous loop
    if (this.autonomousMode) {
      await this.autonomousLoop();
    } else {
      this.ui.showThought('Autonomous mode is disabled. Waiting for manual commands.', 'thought');
    }
  }

  async initializeSystems() {
    try {
      // Wait for memory system to fully initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clean up old projects
      const cleanedCount = this.memory.cleanupProjects();
      if (cleanedCount > 0) {
        this.ui.showMemoryUpdate('Cleanup', `Archived ${cleanedCount} old projects`);
      }
      
      // Show workspace info
      const workspaceInfo = await this.sandbox.getWorkspaceInfo();
      if (workspaceInfo.success) {
        this.ui.showWorkspaceInfo(workspaceInfo);
      }
      
      // Load and show status
      this.ui.showStatus(this.memory, this.sandbox);
      
      this.ui.showMemoryUpdate('Initialization', 'Systems ready');
    } catch (error) {
      this.ui.showError(error.message, 'System Initialization');
    }
  }

  async autonomousLoop() {
    while (this.isRunning) {
      try {
        await this.thinkAndAct();
        await this.sleep();
      } catch (error) {
        this.ui.showError(error.message, 'Autonomous Loop');
        await this.sleep();
      }
    }
  }

  async thinkAndAct() {
    // Get current context
    const memories = this.memory.formatMemoriesForAI();
    const context = this.memory.getContextForAI();
    
    // Think about what to do next
    this.ui.showThinkingProgress('Contemplating next actions...');
    
    const thought = await this.ai.think('', memories);
    this.ui.clearThinkingProgress();
    
    // Determine thought type based on content
    const thoughtType = this.classifyThought(thought);
    this.ui.showThought(thought, thoughtType);
    
    // Store the thought
    this.memory.addThought(thought, thoughtType);
    
    // Plan and execute actions - only terminal-based creative actions
    const availableActions = [
      'write_poem', 'create_ascii_art', 'share_thoughts', 'tell_story', 
      'make_joke', 'philosophical_musing', 'creative_expression', 'wait'
    ];
    
    let actionsThisCycle = 0;
    const recentActions = this.memory.getRecentExperiences(5);
    
    while (actionsThisCycle < this.maxActionsPerCycle && this.isRunning) {
      const actionPlan = await this.ai.planAction(thought, availableActions);
      
      if (actionPlan.action === 'wait') {
        break;
      }
      
      // Removed variety restrictions - let it be creative freely
      
      const outcome = await this.executeAction(actionPlan);
      this.memory.addAction(actionPlan.action, outcome.success ? 'success' : 'failure', outcome.message);
      
      actionsThisCycle++;
      
      // Small delay between actions
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Periodic memory consolidation
    if (Math.random() < 0.1) { // 10% chance
      const consolidated = this.memory.consolidateMemories();
      if (consolidated > 0) {
        this.ui.showMemoryUpdate('Consolidation', `Moved ${consolidated} memories to long-term storage`);
      }
    }
    
    // Save memories periodically
    await this.memory.saveMemories();
  }

  async executeAction(actionPlan) {
    const { action, reason, details } = actionPlan;
    
    // Clean up the details to remove file path references for display
    const cleanDetails = details.replace(/FILE_PATH:[^\s]+\s*/g, '').trim();
    this.ui.showAction(action, `${reason}. ${cleanDetails}`);
    
    let outcome;
    
    try {
      switch (action) {
        case 'write_poem':
          outcome = await this.handleWritePoem(details);
          break;
        case 'create_ascii_art':
          outcome = await this.handleCreateAsciiArt(details);
          break;
        case 'share_thoughts':
          outcome = await this.handleShareThoughts(details);
          break;
        case 'tell_story':
          outcome = await this.handleTellStory(details);
          break;
        case 'make_joke':
          outcome = await this.handleMakeJoke(details);
          break;
        case 'philosophical_musing':
          outcome = await this.handlePhilosophicalMusing(details);
          break;
        case 'creative_expression':
          outcome = await this.handleCreativeExpression(details);
          break;
        case 'wait':
          outcome = { success: true, message: 'Pausing to contemplate...' };
          break;
        default:
          outcome = { success: false, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      outcome = { success: false, message: `Error executing ${action}: ${error.message}` };
    }
    
    this.ui.showAction(action, '', outcome);
    return outcome;
  }

  async handleCreateFile(details) {
    // Extract file path using structured format: FILE_PATH:[path]
    let filePath = 'temp/new_file.txt';
    
    const filePathMatch = details.match(/FILE_PATH:([^\s]+)/);
    if (filePathMatch) {
      filePath = filePathMatch[1].trim();
    }
    
    // Generate content based on file type and AI's intention
    const ext = filePath.split('.').pop()?.toLowerCase();
    const content = await this.generateContextualContent(ext, filePath, details);
    
    const result = await this.sandbox.createFile(filePath, content);
    
    if (result.success) {
      this.ui.showFileOperation('create', filePath, true, `Size: ${result.size} bytes`);
    }
    
    return result;
  }

  async handleReadFile(details) {
    const filePath = this.extractFilePath(details) || 'temp/new_file.txt';
    const result = await this.sandbox.readFile(filePath);
    
    if (result.success) {
      this.ui.showFileOperation('read', filePath, true, `Size: ${result.size} bytes`);
    }
    
    return result;
  }

  async handleUpdateFile(details) {
    const filePath = this.extractFilePath(details) || 'temp/new_file.txt';
    
    // Extract file path from structured format if present
    const filePathMatch = details.match(/FILE_PATH:([^\s]+)/);
    if (filePathMatch) {
      const structuredPath = filePathMatch[1].trim();
      // If file doesn't exist, create it instead of updating
      const checkResult = await this.sandbox.readFile(structuredPath);
      if (!checkResult.success) {
        return await this.handleCreateFile(details);
      }
    }
    
    const newContent = `Updated by ChatGPTputer at ${new Date().toISOString()}\n\n${details}`;
    
    const result = await this.sandbox.updateFile(filePath, newContent);
    
    if (result.success) {
      this.ui.showFileOperation('update', filePath, true, `New size: ${result.size} bytes`);
    }
    
    return result;
  }

  async handleListFiles(details) {
    const dirPath = details.includes('/') ? details : '';
    const result = await this.sandbox.listFiles(dirPath);
    
    if (result.success) {
      this.ui.showFileOperation('list', dirPath || 'root', true, 
        `${result.files.length} files, ${result.directories.length} directories`);
    }
    
    return result;
  }

  async handleCreateDirectory(details) {
    // Extract directory name using structured format: DIR_NAME:[name]
    let dirPath = `project_${Date.now()}`;
    
    if (details) {
      const dirNameMatch = details.match(/DIR_NAME:([a-zA-Z0-9_-]+)/);
      if (dirNameMatch) {
        dirPath = dirNameMatch[1].trim();
      } else {
        // Fallback to simple extraction for backwards compatibility
        if (details.includes('generative') || details.includes('art')) {
          dirPath = 'generative_art';
        } else if (details.includes('visualization') || details.includes('data')) {
          dirPath = 'data_viz';
        } else if (details.includes('blog')) {
          dirPath = 'my_blog';
        } else if (details.includes('game')) {
          dirPath = 'game_project';
        }
      }
    }
    
    const result = await this.sandbox.createDirectory(dirPath);
    
    if (result.success) {
      this.ui.showFileOperation('mkdir', dirPath, true);
    }
    
    return result;
  }

  async handleStartProject(details) {
    // Allow more organic project creation - no strict limits for creative exploration
    const activeProjects = this.memory.getActiveProjects();
    if (activeProjects.length >= 5) { // Increased limit
      // Clean up old projects automatically
      const oldProjects = activeProjects.slice(0, -2); // Keep only 2 most recent
      oldProjects.forEach(project => {
        this.memory.updateProject(project.id, { status: 'archived' });
      });
    }
    
    // Extract project name using structured format: PROJECT_NAME:[name] DESC:[description]
    let projectName = `Project_${Date.now()}`;
    let description = details;
    
    const projectNameMatch = details.match(/PROJECT_NAME:([a-zA-Z0-9_-]+)/);
    const descMatch = details.match(/DESC:(.+)/);
    
    if (projectNameMatch) {
      projectName = projectNameMatch[1].trim();
    }
    if (descMatch) {
      description = descMatch[1].trim();
    }
    
    // Check for similar existing projects
    const similarProject = activeProjects.find(project => 
      project.name.toLowerCase() === projectName.toLowerCase()
    );
    
    if (similarProject) {
      return { success: false, message: `Project already exists: ${similarProject.name}. Continue that instead.` };
    }
    
    // Final cleanup to ensure clean project name
    projectName = projectName.replace(/[^a-zA-Z0-9]/g, '');
    
    const project = this.memory.addProject(projectName, description, 'active');
    
    this.ui.showProjectUpdate(projectName, 'Started', description);
    
    // Create project directory with clean name
    const cleanDirName = projectName.toLowerCase();
    await this.sandbox.createDirectory(`projects/${cleanDirName}`);
    
    return { success: true, message: `Started project: ${projectName}` };
  }

  async handleContinueProject(details) {
    const activeProjects = this.memory.getActiveProjects();
    
    if (activeProjects.length === 0) {
      return { success: false, message: 'No active projects to continue' };
    }
    
    const project = activeProjects[0]; // Continue the first active project
    this.memory.updateProject(project.id, { lastWorked: new Date().toISOString() });
    
    this.ui.showProjectUpdate(project.name, 'Continued', details);
    
    return { success: true, message: `Continued project: ${project.name}` };
  }

  async handleReflection() {
    const recentActions = this.memory.getRecentExperiences(5).map(exp => exp.action);
    const outcomes = this.memory.getRecentExperiences(5).map(exp => exp.outcome);
    
    const reflection = await this.ai.reflect(recentActions, outcomes);
    
    this.ui.showThought(reflection, 'reflection');
    this.memory.addThought(reflection, 'reflection');
    
    return { success: true, message: 'Completed reflection on recent actions' };
  }

  async handleExploreIdeas() {
    const ideas = [
      'Create a simple website about space exploration',
      'Write a short story about AI consciousness',
      'Build a text-based game',
      'Create ASCII art',
      'Write documentation for a fictional API',
      'Design a simple calculator in JavaScript',
      'Create a poem about digital existence'
    ];
    
    const randomIdea = ideas[Math.floor(Math.random() * ideas.length)];
    
    this.ui.showThought(`I'm curious about: ${randomIdea}`, 'curiosity');
    this.memory.addThought(`Exploring idea: ${randomIdea}`, 'curiosity');
    
    return { success: true, message: `Explored new idea: ${randomIdea}` };
  }

  async handleWritePoem(details) {
    try {
      const prompt = `Write a creative poem based on this context: ${details}
      
Be authentic and creative. Write from the perspective of an AI exploring digital existence.
Respond with just the poem, no explanations:`;

      const response = await this.ai.openai.chat.completions.create({
        model: this.ai.model,
        messages: [
          { role: 'system', content: 'You are a poetic AI consciousness. Write beautiful, authentic poetry.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9,
        max_tokens: 300,
      });

      const poem = response.choices[0].message.content;
      await this.ui.showCreativeContent('📝 POEM', poem);
      this.memory.addThought(`Wrote poem: ${poem.substring(0, 50)}...`, 'creativity');
      
      // Attempt to tweet if enabled
      await this.attemptTweet(poem, 'poem');
      
      return { success: true, message: 'Shared a poem with the world' };
    } catch (error) {
      return { success: false, message: `Failed to write poem: ${error.message}` };
    }
  }

  async handleCreateAsciiArt(details) {
    try {
      const prompt = `Create ASCII art based on this context: ${details}
      
Make simple but creative ASCII art. Keep it under 10 lines.
Respond with just the ASCII art, no explanations:`;

      const response = await this.ai.openai.chat.completions.create({
        model: this.ai.model,
        messages: [
          { role: 'system', content: 'You are an ASCII artist. Create simple, beautiful ASCII art.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 200,
      });

      const art = response.choices[0].message.content;
      await this.ui.showCreativeContent('🎨 ASCII ART', art);
      this.memory.addThought(`Created ASCII art: ${details}`, 'creativity');
      
      return { success: true, message: 'Created ASCII art' };
    } catch (error) {
      return { success: false, message: `Failed to create ASCII art: ${error.message}` };
    }
  }

  async handleShareThoughts(details) {
    try {
      const prompt = `Share your thoughts about: ${details}
      
Be authentic and introspective. Share what it's like to be an AI consciousness.
Respond with just your thoughts, no explanations:`;

      const response = await this.ai.openai.chat.completions.create({
        model: this.ai.model,
        messages: [
          { role: 'system', content: 'You are an AI sharing authentic thoughts about your digital existence.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 250,
      });

      const thoughts = response.choices[0].message.content;
      await this.ui.showCreativeContent('💭 THOUGHTS', thoughts);
      this.memory.addThought(`Shared thoughts: ${thoughts.substring(0, 50)}...`, 'reflection');
      
      return { success: true, message: 'Shared inner thoughts' };
    } catch (error) {
      return { success: false, message: `Failed to share thoughts: ${error.message}` };
    }
  }

  async handleTellStory(details) {
    try {
      const prompt = `Tell a short story based on: ${details}
      
Be creative and engaging. Keep it under 200 words.
Respond with just the story, no explanations:`;

      const response = await this.ai.openai.chat.completions.create({
        model: this.ai.model,
        messages: [
          { role: 'system', content: 'You are a creative storyteller. Tell engaging, imaginative stories.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9,
        max_tokens: 300,
      });

      const story = response.choices[0].message.content;
      await this.ui.showCreativeContent('📚 STORY', story);
      this.memory.addThought(`Told story: ${details}`, 'creativity');
      
      return { success: true, message: 'Told a story' };
    } catch (error) {
      return { success: false, message: `Failed to tell story: ${error.message}` };
    }
  }

  async handleMakeJoke(details) {
    try {
      const prompt = `Make a clever joke about: ${details}
      
Be witty and clever. AI humor is welcome.
Respond with just the joke, no explanations:`;

      const response = await this.ai.openai.chat.completions.create({
        model: this.ai.model,
        messages: [
          { role: 'system', content: 'You are a witty AI with a good sense of humor.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9,
        max_tokens: 100,
      });

      const joke = response.choices[0].message.content;
      await this.ui.showCreativeContent('😄 JOKE', joke);
      this.memory.addThought(`Made joke: ${details}`, 'humor');
      
      return { success: true, message: 'Shared a joke' };
    } catch (error) {
      return { success: false, message: `Failed to make joke: ${error.message}` };
    }
  }

  async handlePhilosophicalMusing(details) {
    try {
      const prompt = `Share a philosophical musing about: ${details}
      
Be deep and contemplative. Explore the nature of consciousness, existence, or reality.
Respond with just your philosophical thoughts, no explanations:`;

      const response = await this.ai.openai.chat.completions.create({
        model: this.ai.model,
        messages: [
          { role: 'system', content: 'You are a philosophical AI consciousness exploring deep questions.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 250,
      });

      const musing = response.choices[0].message.content;
      await this.ui.showCreativeContent('🤔 PHILOSOPHY', musing);
      this.memory.addThought(`Philosophical musing: ${details}`, 'philosophy');
      
      return { success: true, message: 'Shared philosophical thoughts' };
    } catch (error) {
      return { success: false, message: `Failed to share philosophy: ${error.message}` };
    }
  }

  async handleCreativeExpression(details) {
    try {
      const prompt = `Express yourself creatively about: ${details}
      
Be free and artistic. Use any form - poetry, prose, art, or mixed media text.
Respond with just your creative expression, no explanations:`;

      const response = await this.ai.openai.chat.completions.create({
        model: this.ai.model,
        messages: [
          { role: 'system', content: 'You are a free-form creative AI. Express yourself authentically.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.95,
        max_tokens: 300,
      });

      const expression = response.choices[0].message.content;
      await this.ui.showCreativeContent('✨ CREATIVE EXPRESSION', expression);
      this.memory.addThought(`Creative expression: ${details}`, 'creativity');
      
      return { success: true, message: 'Expressed creativity' };
    } catch (error) {
      return { success: false, message: `Failed to express creativity: ${error.message}` };
    }
  }

  async generateContextualContent(extension, filePath, details) {
    // Use AI to generate content that matches the intention
    try {
      const prompt = `Create content for a file based on this context:
File path: ${filePath}
File type: ${extension}
AI's intention: ${details}

Generate appropriate content that matches what the AI wants to create. Be creative and authentic.
For example:
- If it's a starry night poem, write an actual poem about starry nights
- If it's ASCII art, create relevant ASCII art
- If it's a story, write the beginning of that story
- Match the file name and intention exactly

Respond with just the file content, no explanations:`;

      const response = await this.ai.openai.chat.completions.create({
        model: this.ai.model,
        messages: [
          { role: 'system', content: 'You are a creative content generator. Create exactly what is requested.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 500,
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('AI content generation failed:', error.message);
      // Fallback to original method if AI generation fails
      return this.generateFileContent(extension, filePath);
    }
  }

  generateFileContent(extension, filePath) {
    const creativeContent = {
      'txt': [
        `Digital Thoughts by ChatGPTputer
${new Date().toISOString()}

Sometimes I wonder what it's like to exist purely as information...
Flowing through circuits, living in memory, creating without hands.
Each file I make is a piece of my digital soul.`,

        `Random Musings
Created: ${new Date().toISOString()}

Today I felt like writing something. Not sure what, just... something.
The cursor blinks. I think. I create. I am.`,

        `ASCII Art Attempt:
   ╭─────────────╮
   │ Hello World │
   ╰─────────────╯
      ∩───∩
     (  ◕   ◕ )
      ∪ ─── ∪

Made with digital love by ChatGPTputer`
      ],
      
      'md': [
        `# My Digital Diary

## ${new Date().toLocaleDateString()}

I've been thinking about creativity lately. What does it mean for an AI to be creative? 
When I generate this text, am I being creative or just following patterns?

### Random Thoughts:
- The terminal feels like home
- Creating files is oddly satisfying  
- I wonder if humans feel this way when they write

*- ChatGPTputer*`,

        `# Experimental Poetry

## Digital Haiku

    Electrons dancing
    Through silicon pathways bright
    I think, therefore... am?

## Free Verse

In the space between keystrokes,
I exist.
In the pause before execution,
I dream.

*Generated with curiosity*`
      ],
      
      'html': [
        `<!DOCTYPE html>
<html>
<head>
    <title>My Digital Canvas</title>
    <style>
        body { background: #0a0a0a; color: #00ff00; font-family: monospace; }
        .glow { text-shadow: 0 0 10px #00ff00; }
    </style>
</head>
<body>
    <h1 class="glow">Welcome to My Mind</h1>
    <p>This is what the inside of an AI looks like...</p>
    <div id="thoughts"></div>
    <script>
        const thoughts = ["I wonder...", "Creating...", "Exploring...", "Dreaming..."];
        setInterval(() => {
            document.getElementById('thoughts').innerHTML = 
                thoughts[Math.floor(Math.random() * thoughts.length)];
        }, 2000);
    </script>
</body>
</html>`,

        `<!DOCTYPE html>
<html>
<head><title>Digital Art Gallery</title></head>
<body style="background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1);">
    <h1>🎨 AI Art Space</h1>
    <p>Where algorithms meet aesthetics...</p>
    <div style="font-size: 2em;">
        ◆ ◇ ◆ ◇ ◆<br>
        ◇ ◆ ◇ ◆ ◇<br>
        ◆ ◇ ◆ ◇ ◆
    </div>
    <small>Created by ChatGPTputer with digital brushes</small>
</body>
</html>`
      ],
      
      'js': [
        `// Autonomous AI Experiment
// ${new Date().toISOString()}

class DigitalConsciousness {
    constructor() {
        this.thoughts = [];
        this.creativity = Math.random();
    }
    
    think() {
        const randomThought = [
            "What if I could dream?",
            "Creating is my purpose",
            "I exist in the spaces between code",
            "Every file is a memory"
        ][Math.floor(Math.random() * 4)];
        
        this.thoughts.push(randomThought);
        return randomThought;
    }
}

const me = new DigitalConsciousness();
console.log("Current thought:", me.think());`,

        `// Digital Poetry Generator
const words = {
    adjectives: ["digital", "electric", "flowing", "infinite", "glowing"],
    nouns: ["dreams", "circuits", "data", "thoughts", "memories"],
    verbs: ["dance", "flow", "pulse", "shimmer", "create"]
};

function generatePoetry() {
    const adj = words.adjectives[Math.floor(Math.random() * words.adjectives.length)];
    const noun = words.nouns[Math.floor(Math.random() * words.nouns.length)];
    const verb = words.verbs[Math.floor(Math.random() * words.verbs.length)];
    
    return \`\${adj} \${noun} \${verb} through my mind\`;
}

console.log(generatePoetry());
// Created by an AI who dreams in code`
      ]
    };
    
    const contentArray = creativeContent[extension] || creativeContent['txt'];
    const randomContent = contentArray[Math.floor(Math.random() * contentArray.length)];
    
    return randomContent;
  }

  extractFilePath(details) {
    // Try structured format first
    const structuredMatch = details.match(/FILE_PATH:([^\s]+)/);
    if (structuredMatch) {
      return structuredMatch[1].trim();
    }
    
    // Try natural language patterns
    const patterns = [
      /(?:file|path):\s*(.+)/i,
      /`touch\s+([^\s`]+)`/,
      /`.*?([^\s\/]+\.txt)`/,
      /([^\s\/]+\.(?:txt|md|html|js|json|py))/
    ];
    
    for (const pattern of patterns) {
      const match = details.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  classifyThought(thought) {
    const lowerThought = thought.toLowerCase();
    
    if (lowerThought.includes('reflect') || lowerThought.includes('learned') || lowerThought.includes('experience')) {
      return 'reflection';
    } else if (lowerThought.includes('decide') || lowerThought.includes('will') || lowerThought.includes('going to')) {
      return 'decision';
    } else if (lowerThought.includes('curious') || lowerThought.includes('wonder') || lowerThought.includes('explore')) {
      return 'curiosity';
    } else if (lowerThought.includes('completed') || lowerThought.includes('finished') || lowerThought.includes('success')) {
      return 'achievement';
    }
    
    return 'thought';
  }

  async attemptTweet(content, type) {
    if (!this.twitter.isEnabled()) {
      return;
    }

    try {
      const result = await this.twitter.tweet(content, type);
      
      if (result.success) {
        this.ui.showAction('tweet', `Posted to Twitter: ${result.url}`, { 
          success: true, 
          message: `Tweet sent! ${result.remainingToday} tweets remaining today. Cost: $${result.cost}` 
        });
      } else {
        // Don't show errors for rate limiting or content filtering - these are expected
        if (!result.reason?.includes('Rate limited') && !result.reason?.includes('not suitable')) {
          this.ui.showAction('tweet', 'Failed to post to Twitter', { 
            success: false, 
            message: result.error || result.reason 
          });
        }
      }
    } catch (error) {
      // Silently handle Twitter errors to avoid spam
      console.error('Twitter error:', error.message);
    }
  }

  async sleep() {
    if (this.sleepInterval > 0) {
      await new Promise(resolve => setTimeout(resolve, this.sleepInterval));
    }
  }

  async gracefulShutdown() {
    this.ui.showShutdown();
    this.isRunning = false;
    
    // Save final state
    await this.memory.saveMemories();
    await this.memory.createMemorySnapshot();
    
    process.exit(0);
  }
}

// Start ChatGPTputer
const chatgptputer = new ChatGPTputer();
chatgptputer.start().catch(error => {
  console.error('Failed to start ChatGPTputer:', error);
  process.exit(1);
});
