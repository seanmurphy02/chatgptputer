import fs from 'fs-extra';
import path from 'path';

class MemorySystem {
  constructor(memoryPath = './memory') {
    this.memoryPath = memoryPath;
    this.sessionMemory = [];
    this.longTermMemory = [];
    this.experiences = [];
    this.projects = [];
    
    this.init();
  }

  async init() {
    try {
      await fs.ensureDir(this.memoryPath);
      await this.loadMemories();
    } catch (error) {
      console.error('Memory initialization error:', error.message);
    }
  }

  async loadMemories() {
    try {
      // Load long-term memories
      const longTermPath = path.join(this.memoryPath, 'long-term.json');
      if (await fs.pathExists(longTermPath)) {
        this.longTermMemory = await fs.readJson(longTermPath);
      }

      // Load experiences
      const experiencesPath = path.join(this.memoryPath, 'experiences.json');
      if (await fs.pathExists(experiencesPath)) {
        this.experiences = await fs.readJson(experiencesPath);
      }

      // Load projects
      const projectsPath = path.join(this.memoryPath, 'projects.json');
      if (await fs.pathExists(projectsPath)) {
        this.projects = await fs.readJson(projectsPath);
      }

      console.log(`[Memory] Loaded ${this.longTermMemory.length} memories, ${this.experiences.length} experiences, ${this.projects.length} projects`);
    } catch (error) {
      console.error('Error loading memories:', error.message);
    }
  }

  async saveMemories() {
    try {
      await fs.writeJson(path.join(this.memoryPath, 'long-term.json'), this.longTermMemory, { spaces: 2 });
      await fs.writeJson(path.join(this.memoryPath, 'experiences.json'), this.experiences, { spaces: 2 });
      await fs.writeJson(path.join(this.memoryPath, 'projects.json'), this.projects, { spaces: 2 });
    } catch (error) {
      console.error('Error saving memories:', error.message);
    }
  }

  addThought(thought, type = 'thought') {
    const memory = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type: type,
      content: thought,
      session: true
    };

    this.sessionMemory.push(memory);
    
    // Keep session memory manageable
    if (this.sessionMemory.length > 50) {
      this.sessionMemory = this.sessionMemory.slice(-30);
    }

    return memory;
  }

  addAction(action, outcome, details = '') {
    const actionMemory = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type: 'action',
      action: action,
      outcome: outcome,
      details: details,
      session: true
    };

    this.sessionMemory.push(actionMemory);
    this.experiences.push(actionMemory);

    // Keep experiences manageable
    if (this.experiences.length > 200) {
      this.experiences = this.experiences.slice(-150);
    }

    return actionMemory;
  }

  addProject(name, description, status = 'active') {
    const project = {
      id: Date.now(),
      name: name,
      description: description,
      status: status,
      created: new Date().toISOString(),
      lastWorked: new Date().toISOString(),
      files: [],
      notes: []
    };

    this.projects.push(project);
    return project;
  }

  updateProject(projectId, updates) {
    const projectIndex = this.projects.findIndex(p => p.id === projectId);
    if (projectIndex !== -1) {
      this.projects[projectIndex] = { ...this.projects[projectIndex], ...updates };
      this.projects[projectIndex].lastWorked = new Date().toISOString();
      return this.projects[projectIndex];
    }
    return null;
  }

  getActiveProjects() {
    return this.projects.filter(p => p.status === 'active');
  }

  cleanupProjects() {
    // Mark old projects as completed and keep only the most recent ones
    const now = new Date();
    let cleanedCount = 0;
    
    // Sort projects by creation date
    this.projects.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    // Keep only the 2 most recent active projects
    const activeProjects = this.projects.filter(p => p.status === 'active');
    if (activeProjects.length > 2) {
      // Mark older projects as completed
      for (let i = 2; i < activeProjects.length; i++) {
        activeProjects[i].status = 'completed';
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  getRecentMemories(count = 10) {
    return this.sessionMemory.slice(-count);
  }

  getRecentExperiences(count = 5) {
    return this.experiences.slice(-count);
  }

  consolidateMemories() {
    // Move important session memories to long-term storage
    const importantMemories = this.sessionMemory.filter(memory => 
      memory.type === 'reflection' || 
      memory.type === 'achievement' ||
      (memory.type === 'action' && memory.outcome === 'success')
    );

    this.longTermMemory.push(...importantMemories);

    // Keep long-term memory manageable
    if (this.longTermMemory.length > 100) {
      this.longTermMemory = this.longTermMemory.slice(-80);
    }

    return importantMemories.length;
  }

  getContextForAI() {
    const recentMemories = this.getRecentMemories(5);
    const activeProjects = this.getActiveProjects();
    const recentExperiences = this.getRecentExperiences(3);

    return {
      recentThoughts: recentMemories.filter(m => m.type === 'thought'),
      activeProjects: activeProjects,
      recentActions: recentExperiences,
      sessionLength: this.sessionMemory.length
    };
  }

  formatMemoriesForAI() {
    const context = this.getContextForAI();
    const messages = [];

    // Add recent thoughts as assistant messages
    context.recentThoughts.forEach(thought => {
      messages.push({
        role: 'assistant',
        content: thought.content
      });
    });

    // Add recent actions as user context
    if (context.recentActions.length > 0) {
      const actionsText = context.recentActions
        .map(action => `${action.action}: ${action.outcome}`)
        .join(', ');
      
      messages.push({
        role: 'user',
        content: `Recent actions: ${actionsText}`
      });
    }

    return messages;
  }

  async createMemorySnapshot() {
    const snapshot = {
      timestamp: new Date().toISOString(),
      sessionMemories: this.sessionMemory.length,
      longTermMemories: this.longTermMemory.length,
      experiences: this.experiences.length,
      activeProjects: this.getActiveProjects().length,
      totalProjects: this.projects.length
    };

    await fs.writeJson(
      path.join(this.memoryPath, `snapshot-${Date.now()}.json`), 
      snapshot, 
      { spaces: 2 }
    );

    return snapshot;
  }
}

export default MemorySystem;
