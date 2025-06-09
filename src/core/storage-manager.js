// StorageManager - Wrapper for localStorage with namespace support
export class StorageManager {
  constructor(namespace = 'app') {
    this.namespace = namespace;
    this.storage = window.localStorage;
  }
  
  _getKey(key) {
    return `${this.namespace}:${key}`;
  }
  
  set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      this.storage.setItem(this._getKey(key), serialized);
      return true;
    } catch (error) {
      console.error('Failed to save to storage:', error);
      return false;
    }
  }
  
  get(key, defaultValue = null) {
    try {
      const item = this.storage.getItem(this._getKey(key));
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Failed to read from storage:', error);
      return defaultValue;
    }
  }
  
  remove(key) {
    try {
      this.storage.removeItem(this._getKey(key));
      return true;
    } catch (error) {
      console.error('Failed to remove from storage:', error);
      return false;
    }
  }
  
  clear() {
    try {
      // Only clear items with our namespace
      const keys = [];
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(this.namespace + ':')) {
          keys.push(key);
        }
      }
      
      keys.forEach(key => this.storage.removeItem(key));
      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return false;
    }
  }
  
  has(key) {
    return this.storage.getItem(this._getKey(key)) !== null;
  }
}