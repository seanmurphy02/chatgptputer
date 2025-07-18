import chalk from 'chalk';
import cliProgress from 'cli-progress';

class TerminalUI {
  constructor() {
    this.isRunning = false;
    this.currentThought = '';
    this.actionCount = 0;
    this.startTime = new Date();
    
    // Progress bar for thinking
    this.thinkingBar = new cliProgress.SingleBar({
      format: chalk.cyan('[Thinking]') + ' |{bar}| {percentage}% | {value}/{total}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
  }

  clear() {
    console.clear();
  }

  showHeader() {
    console.log(chalk.bold.magenta('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.magenta('║') + chalk.bold.white('                        ChatGPTputer v1.0                     ') + chalk.bold.magenta('║'));
    console.log(chalk.bold.magenta('║') + chalk.gray('                   Autonomous AI Terminal Agent                ') + chalk.bold.magenta('║'));
    console.log(chalk.bold.magenta('╚══════════════════════════════════════════════════════════════╝'));
    console.log();
  }

  showStatus(memory, sandbox) {
    const uptime = this.getUptime();
    const memoryInfo = memory.getContextForAI();
    
    console.log(chalk.bold.blue('┌─ System Status ─────────────────────────────────────────────┐'));
    console.log(chalk.blue('│') + ` Status: ${chalk.green('ACTIVE')}` + ' '.repeat(47) + chalk.blue('│'));
    console.log(chalk.blue('│') + ` Uptime: ${chalk.yellow(uptime)}` + ' '.repeat(47 - uptime.length) + chalk.blue('│'));
    console.log(chalk.blue('│') + ` Actions: ${chalk.cyan(this.actionCount)}` + ' '.repeat(46 - this.actionCount.toString().length) + chalk.blue('│'));
    console.log(chalk.blue('│') + ` Active Projects: ${chalk.magenta(memoryInfo.activeProjects.length)}` + ' '.repeat(38 - memoryInfo.activeProjects.length.toString().length) + chalk.blue('│'));
    console.log(chalk.blue('│') + ` Session Memories: ${chalk.white(memoryInfo.sessionLength)}` + ' '.repeat(37 - memoryInfo.sessionLength.toString().length) + chalk.blue('│'));
    console.log(chalk.bold.blue('└─────────────────────────────────────────────────────────────┘'));
    console.log();
  }

  showThought(thought, type = 'thought') {
    const timestamp = this.getTimestamp();
    const typeColors = {
      thought: chalk.cyan,
      reflection: chalk.yellow,
      decision: chalk.green,
      curiosity: chalk.magenta,
      achievement: chalk.bold.green
    };
    
    const color = typeColors[type] || chalk.cyan;
    const icon = this.getThoughtIcon(type);
    
    console.log(color(`${timestamp} ${icon} [${type.toUpperCase()}]`));
    console.log(color(`│ ${thought}`));
    console.log(color('└─'));
    console.log();
    
    this.currentThought = thought;
  }

  showAction(action, details = '', outcome = null) {
    const timestamp = this.getTimestamp();
    this.actionCount++;
    
    if (outcome === null) {
      // Action starting
      console.log(chalk.bold.yellow(`${timestamp} ⚡ [ACTION] ${action.toUpperCase()}`));
      if (details) {
        console.log(chalk.yellow(`│ ${details}`));
      }
      console.log(chalk.yellow('│ Processing...'));
    } else {
      // Action completed
      const statusColor = outcome.success ? chalk.green : chalk.red;
      const statusIcon = outcome.success ? '✓' : '✗';
      
      console.log(statusColor(`│ ${statusIcon} ${outcome.message}`));
      console.log(statusColor('└─'));
      console.log();
    }
  }

  showMemoryUpdate(type, details) {
    const timestamp = this.getTimestamp();
    console.log(chalk.gray(`${timestamp} 🧠 [MEMORY] ${type}: ${details}`));
    console.log();
  }

  showError(error, context = '') {
    const timestamp = this.getTimestamp();
    console.log(chalk.red(`${timestamp} ❌ [ERROR] ${context}`));
    console.log(chalk.red(`│ ${error}`));
    console.log(chalk.red('└─'));
    console.log();
  }

  showProjectUpdate(projectName, action, details = '') {
    const timestamp = this.getTimestamp();
    console.log(chalk.blue(`${timestamp} 📁 [PROJECT] ${projectName}`));
    console.log(chalk.blue(`│ ${action}: ${details}`));
    console.log(chalk.blue('└─'));
    console.log();
  }

  showFileOperation(operation, filePath, success = true, details = '') {
    const timestamp = this.getTimestamp();
    const statusIcon = success ? '📄' : '❌';
    const color = success ? chalk.green : chalk.red;
    
    console.log(color(`${timestamp} ${statusIcon} [FILE] ${operation.toUpperCase()}`));
    console.log(color(`│ Path: ${filePath}`));
    if (details) {
      console.log(color(`│ ${details}`));
    }
    console.log(color('└─'));
    console.log();
  }

  showThinkingProgress(message = 'Thinking...') {
    // Simple thinking indicator
    process.stdout.write(chalk.cyan(`\r${this.getTimestamp()} 🤔 ${message}`));
  }

  clearThinkingProgress() {
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
  }

  showSeparator() {
    console.log(chalk.gray('─'.repeat(64)));
    console.log();
  }

  showWakeUp() {
    console.log(chalk.bold.green(`${this.getTimestamp()} 🌅 [SYSTEM] ChatGPTputer is waking up...`));
    console.log(chalk.green('│ Loading memories and initializing systems...'));
    console.log(chalk.green('└─'));
    console.log();
  }

  showSleep() {
    console.log(chalk.bold.blue(`${this.getTimestamp()} 😴 [SYSTEM] ChatGPTputer is resting...`));
    console.log(chalk.blue('│ Consolidating memories and saving state...'));
    console.log(chalk.blue('└─'));
    console.log();
  }

  showShutdown() {
    console.log();
    console.log(chalk.bold.red(`${this.getTimestamp()} 🔴 [SYSTEM] ChatGPTputer is shutting down...`));
    console.log(chalk.red('│ Saving all memories and project state...'));
    console.log(chalk.red('│ Goodbye! 👋'));
    console.log(chalk.red('└─'));
    console.log();
  }

  getTimestamp() {
    const now = new Date();
    return chalk.gray(`[${now.toLocaleTimeString()}]`);
  }

  getUptime() {
    const now = new Date();
    const diff = now - this.startTime;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  getThoughtIcon(type) {
    const icons = {
      thought: '💭',
      reflection: '🤔',
      decision: '⚡',
      curiosity: '🔍',
      achievement: '🎉'
    };
    return icons[type] || '💭';
  }

  showWorkspaceInfo(info) {
    console.log(chalk.bold.blue('┌─ Workspace Info ───────────────────────────────────────────┐'));
    console.log(chalk.blue('│') + ` Path: ${chalk.white(info.path)}` + ' '.repeat(55 - info.path.length) + chalk.blue('│'));
    console.log(chalk.blue('│') + ` Files: ${chalk.cyan(info.totalFiles)}` + ' '.repeat(50 - info.totalFiles.toString().length) + chalk.blue('│'));
    console.log(chalk.blue('│') + ` Directories: ${chalk.cyan(info.directories)}` + ' '.repeat(44 - info.directories.toString().length) + chalk.blue('│'));
    console.log(chalk.blue('│') + ` Total Size: ${chalk.yellow(this.formatBytes(info.totalSize))}` + ' '.repeat(47 - this.formatBytes(info.totalSize).length) + chalk.blue('│'));
    console.log(chalk.bold.blue('└─────────────────────────────────────────────────────────────┘'));
    console.log();
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async showCreativeContent(type, content) {
    const timestamp = this.getTimestamp();
    console.log(chalk.bold.magenta(`${timestamp} ${type}`));
    console.log(chalk.magenta('┌─────────────────────────────────────────────────────────────┐'));
    
    // Split content into lines and display each one with typewriter effect
    const lines = content.split('\n');
    for (const line of lines) {
      const truncatedLine = line.length > 59 ? line.substring(0, 56) + '...' : line;
      const padding = ' '.repeat(Math.max(0, 59 - truncatedLine.length));
      
      // Typewriter effect - show each character slowly
      process.stdout.write(chalk.magenta('│ '));
      for (let i = 0; i < truncatedLine.length; i++) {
        process.stdout.write(chalk.white(truncatedLine[i]));
        await new Promise(resolve => setTimeout(resolve, 30)); // 30ms per character
      }
      console.log(padding + chalk.magenta(' │'));
      
      // Small pause between lines
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(chalk.magenta('└─────────────────────────────────────────────────────────────┘'));
    console.log();
  }

  showHelp() {
    console.log(chalk.bold.yellow('┌─ ChatGPTputer Commands ────────────────────────────────────┐'));
    console.log(chalk.yellow('│') + ' Ctrl+C: Graceful shutdown' + ' '.repeat(32) + chalk.yellow('│'));
    console.log(chalk.yellow('│') + ' Ctrl+Z: Pause/Resume (Windows)' + ' '.repeat(28) + chalk.yellow('│'));
    console.log(chalk.yellow('│') + ' The AI operates autonomously - just watch and enjoy!' + ' '.repeat(8) + chalk.yellow('│'));
    console.log(chalk.bold.yellow('└─────────────────────────────────────────────────────────────┘'));
    console.log();
  }
}

export default TerminalUI;
