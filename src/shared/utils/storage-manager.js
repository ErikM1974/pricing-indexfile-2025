// StorageManager - Unified storage interface with fallbacks
// Handles localStorage, sessionStorage, and memory storage

export class StorageManager {
  constructor(prefix = 'nwca_') {
    this.prefix = prefix;
    this.memory = new Map();
    this.type = this.detectStorageType();
  }
  
  detectStorageType() {
    // Test localStorage
    try {
      const testKey = `${this.prefix}test`;
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return 'localStorage';
    } catch (e) {
      // Test sessionStorage
      try {
        const testKey = `${this.prefix}test`;
        sessionStorage.setItem(testKey, 'test');
        sessionStorage.removeItem(testKey);
        return 'sessionStorage';
      } catch (e) {
        // Fall back to memory storage
        return 'memory';
      }
    }
  }
  
  getKey(key) {
    return `${this.prefix}${key}`;
  }
  
  set(key, value, options = {}) {
    const prefixedKey = this.getKey(key);
    const data = {
      value,
      timestamp: Date.now(),
      expires: options.expires || null
    };
    
    try {
      const serialized = JSON.stringify(data);
      
      switch (this.type) {
        case 'localStorage':
          localStorage.setItem(prefixedKey, serialized);
          break;
        case 'sessionStorage':
          sessionStorage.setItem(prefixedKey, serialized);
          break;
        case 'memory':
          this.memory.set(prefixedKey, data);
          break;
      }
      
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      // Try memory storage as fallback
      this.memory.set(prefixedKey, data);
      return true;
    }
  }
  
  get(key, defaultValue = null) {
    const prefixedKey = this.getKey(key);
    
    try {
      let data;
      
      switch (this.type) {
        case 'localStorage':
          const localData = localStorage.getItem(prefixedKey);
          data = localData ? JSON.parse(localData) : null;
          break;
        case 'sessionStorage':
          const sessionData = sessionStorage.getItem(prefixedKey);
          data = sessionData ? JSON.parse(sessionData) : null;
          break;
        case 'memory':
          data = this.memory.get(prefixedKey);
          break;
      }
      
      if (!data) return defaultValue;
      
      // Check expiration
      if (data.expires && data.expires < Date.now()) {
        this.remove(key);
        return defaultValue;
      }
      
      return data.value;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  }
  
  remove(key) {
    const prefixedKey = this.getKey(key);
    
    try {
      switch (this.type) {
        case 'localStorage':
          localStorage.removeItem(prefixedKey);
          break;
        case 'sessionStorage':
          sessionStorage.removeItem(prefixedKey);
          break;
        case 'memory':
          this.memory.delete(prefixedKey);
          break;
      }
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  }
  
  clear(pattern = null) {
    try {
      if (pattern) {
        // Clear only keys matching pattern
        const regex = new RegExp(pattern);
        
        switch (this.type) {
          case 'localStorage':
          case 'sessionStorage':
            const storage = this.type === 'localStorage' ? localStorage : sessionStorage;
            const keys = Object.keys(storage);
            keys.forEach(key => {
              if (key.startsWith(this.prefix) && regex.test(key)) {
                storage.removeItem(key);
              }
            });
            break;
          case 'memory':
            for (const key of this.memory.keys()) {
              if (regex.test(key)) {
                this.memory.delete(key);
              }
            }
            break;
        }
      } else {
        // Clear all with prefix
        switch (this.type) {
          case 'localStorage':
          case 'sessionStorage':
            const storage = this.type === 'localStorage' ? localStorage : sessionStorage;
            const keys = Object.keys(storage);
            keys.forEach(key => {
              if (key.startsWith(this.prefix)) {
                storage.removeItem(key);
              }
            });
            break;
          case 'memory':
            this.memory.clear();
            break;
        }
      }
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  }
  
  // Get all keys with prefix
  keys() {
    const keys = [];
    
    try {
      switch (this.type) {
        case 'localStorage':
        case 'sessionStorage':
          const storage = this.type === 'localStorage' ? localStorage : sessionStorage;
          Object.keys(storage).forEach(key => {
            if (key.startsWith(this.prefix)) {
              keys.push(key.replace(this.prefix, ''));
            }
          });
          break;
        case 'memory':
          for (const key of this.memory.keys()) {
            keys.push(key.replace(this.prefix, ''));
          }
          break;
      }
    } catch (error) {
      console.error('Storage keys error:', error);
    }
    
    return keys;
  }
  
  // Get storage size (approximate)
  getSize() {
    let size = 0;
    
    try {
      switch (this.type) {
        case 'localStorage':
        case 'sessionStorage':
          const storage = this.type === 'localStorage' ? localStorage : sessionStorage;
          Object.keys(storage).forEach(key => {
            if (key.startsWith(this.prefix)) {
              size += key.length + storage.getItem(key).length;
            }
          });
          break;
        case 'memory':
          for (const [key, value] of this.memory.entries()) {
            size += key.length + JSON.stringify(value).length;
          }
          break;
      }
    } catch (error) {
      console.error('Storage size error:', error);
    }
    
    return size;
  }
}