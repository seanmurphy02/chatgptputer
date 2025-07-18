import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class SandboxSystem {
  constructor(sandboxPath = './sandbox') {
    this.sandboxPath = path.resolve(sandboxPath);
    this.allowedExtensions = [
      '.txt', '.md', '.json', '.js', '.html', '.css', '.py', '.java', '.cpp', '.c',
      '.xml', '.yaml', '.yml', '.csv', '.log', '.sh', '.bat', '.ps1', '.sql'
    ];
    this.maxFileSize = 10 * 1024 * 1024; // 10MB limit
    
    this.init();
  }

  async init() {
    try {
      await fs.ensureDir(this.sandboxPath);
      await fs.ensureDir(path.join(this.sandboxPath, 'projects'));
      await fs.ensureDir(path.join(this.sandboxPath, 'experiments'));
      await fs.ensureDir(path.join(this.sandboxPath, 'writings'));
      await fs.ensureDir(path.join(this.sandboxPath, 'temp'));
      
      console.log(`[Sandbox] Initialized at ${this.sandboxPath}`);
    } catch (error) {
      console.error('Sandbox initialization error:', error.message);
    }
  }

  isPathSafe(filePath) {
    const resolvedPath = path.resolve(filePath);
    return resolvedPath.startsWith(this.sandboxPath);
  }

  isExtensionAllowed(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.allowedExtensions.includes(ext) || ext === '';
  }

  async createFile(filePath, content = '') {
    try {
      const fullPath = path.join(this.sandboxPath, filePath);
      
      if (!this.isPathSafe(fullPath)) {
        throw new Error('Path outside sandbox not allowed');
      }

      if (!this.isExtensionAllowed(fullPath)) {
        throw new Error('File extension not allowed');
      }

      if (Buffer.byteLength(content, 'utf8') > this.maxFileSize) {
        throw new Error('File size exceeds limit');
      }

      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content, 'utf8');
      
      return {
        success: true,
        path: filePath,
        size: Buffer.byteLength(content, 'utf8'),
        message: `Created file: ${filePath}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to create file: ${error.message}`
      };
    }
  }

  async readFile(filePath) {
    try {
      const fullPath = path.join(this.sandboxPath, filePath);
      
      if (!this.isPathSafe(fullPath)) {
        throw new Error('Path outside sandbox not allowed');
      }

      if (!(await fs.pathExists(fullPath))) {
        throw new Error('File does not exist');
      }

      const stats = await fs.stat(fullPath);
      if (stats.size > this.maxFileSize) {
        throw new Error('File too large to read');
      }

      const content = await fs.readFile(fullPath, 'utf8');
      
      return {
        success: true,
        content: content,
        size: stats.size,
        message: `Read file: ${filePath}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to read file: ${error.message}`
      };
    }
  }

  async updateFile(filePath, content) {
    try {
      const fullPath = path.join(this.sandboxPath, filePath);
      
      if (!this.isPathSafe(fullPath)) {
        throw new Error('Path outside sandbox not allowed');
      }

      if (!(await fs.pathExists(fullPath))) {
        throw new Error('File does not exist');
      }

      if (Buffer.byteLength(content, 'utf8') > this.maxFileSize) {
        throw new Error('File size exceeds limit');
      }

      await fs.writeFile(fullPath, content, 'utf8');
      
      return {
        success: true,
        path: filePath,
        size: Buffer.byteLength(content, 'utf8'),
        message: `Updated file: ${filePath}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to update file: ${error.message}`
      };
    }
  }

  async deleteFile(filePath) {
    try {
      const fullPath = path.join(this.sandboxPath, filePath);
      
      if (!this.isPathSafe(fullPath)) {
        throw new Error('Path outside sandbox not allowed');
      }

      if (!(await fs.pathExists(fullPath))) {
        throw new Error('File does not exist');
      }

      await fs.remove(fullPath);
      
      return {
        success: true,
        message: `Deleted file: ${filePath}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to delete file: ${error.message}`
      };
    }
  }

  async listFiles(dirPath = '') {
    try {
      const fullPath = path.join(this.sandboxPath, dirPath);
      
      if (!this.isPathSafe(fullPath)) {
        throw new Error('Path outside sandbox not allowed');
      }

      if (!(await fs.pathExists(fullPath))) {
        throw new Error('Directory does not exist');
      }

      const items = await fs.readdir(fullPath, { withFileTypes: true });
      const files = [];
      const directories = [];

      for (const item of items) {
        if (item.isDirectory()) {
          directories.push(item.name);
        } else {
          const filePath = path.join(fullPath, item.name);
          const stats = await fs.stat(filePath);
          files.push({
            name: item.name,
            size: stats.size,
            modified: stats.mtime
          });
        }
      }

      return {
        success: true,
        files: files,
        directories: directories,
        message: `Listed contents of: ${dirPath || 'root'}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to list files: ${error.message}`
      };
    }
  }

  async createDirectory(dirPath) {
    try {
      const fullPath = path.join(this.sandboxPath, dirPath);
      
      if (!this.isPathSafe(fullPath)) {
        throw new Error('Path outside sandbox not allowed');
      }

      await fs.ensureDir(fullPath);
      
      return {
        success: true,
        message: `Created directory: ${dirPath}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to create directory: ${error.message}`
      };
    }
  }

  async executeCommand(command, workingDir = '') {
    try {
      // Only allow safe commands
      const safeCommands = ['dir', 'ls', 'echo', 'type', 'cat', 'head', 'tail', 'find', 'grep'];
      const commandParts = command.trim().split(' ');
      const baseCommand = commandParts[0].toLowerCase();

      if (!safeCommands.includes(baseCommand)) {
        throw new Error('Command not allowed in sandbox');
      }

      const fullWorkingDir = path.join(this.sandboxPath, workingDir);
      
      if (!this.isPathSafe(fullWorkingDir)) {
        throw new Error('Working directory outside sandbox not allowed');
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: fullWorkingDir,
        timeout: 5000, // 5 second timeout
        maxBuffer: 1024 * 1024 // 1MB buffer
      });

      return {
        success: true,
        stdout: stdout,
        stderr: stderr,
        message: `Executed: ${command}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to execute command: ${error.message}`
      };
    }
  }

  async getWorkspaceInfo() {
    try {
      const stats = await this.getDirectoryStats(this.sandboxPath);
      
      return {
        success: true,
        path: this.sandboxPath,
        totalFiles: stats.fileCount,
        totalSize: stats.totalSize,
        directories: stats.dirCount,
        message: 'Workspace info retrieved'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to get workspace info'
      };
    }
  }

  async getDirectoryStats(dirPath) {
    let fileCount = 0;
    let dirCount = 0;
    let totalSize = 0;

    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      
      if (item.isDirectory()) {
        dirCount++;
        const subStats = await this.getDirectoryStats(fullPath);
        fileCount += subStats.fileCount;
        dirCount += subStats.dirCount;
        totalSize += subStats.totalSize;
      } else {
        fileCount++;
        const stats = await fs.stat(fullPath);
        totalSize += stats.size;
      }
    }

    return { fileCount, dirCount, totalSize };
  }

  getAvailableActions() {
    return [
      'create_file',
      'read_file', 
      'update_file',
      'delete_file',
      'list_files',
      'create_directory',
      'execute_command',
      'get_workspace_info'
    ];
  }
}

export default SandboxSystem;
