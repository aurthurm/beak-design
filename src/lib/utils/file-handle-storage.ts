/**
 * Store FileSystemDirectoryHandle in IndexedDB
 * FileSystemHandle objects can be serialized and stored in IndexedDB
 */

const DB_NAME = 'beak_file_handles'
const STORE_NAME = 'handles'

/**
 * Initialize IndexedDB for storing file handles
 */
async function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

/**
 * Store a FileSystemDirectoryHandle
 * Returns an ID that can be used to retrieve it later
 */
export async function storeDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  id: string = 'workspace'
): Promise<string> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    throw new Error('IndexedDB not available')
  }
  
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(handle, id)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(id)
  })
}

/**
 * Retrieve a FileSystemDirectoryHandle by ID
 */
export async function getDirectoryHandle(id: string = 'workspace'): Promise<FileSystemDirectoryHandle | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return null
  }
  
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  } catch (error) {
    console.error('Failed to get directory handle:', error)
    return null
  }
}

/**
 * Remove a stored handle
 */
export async function removeDirectoryHandle(id: string = 'workspace'): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return
  }
  
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Save a file directly to the workspace directory using File System Access API
 */
export async function saveFileToWorkspace(
  handle: FileSystemDirectoryHandle,
  filename: string,
  content: string
): Promise<void> {
  // Ensure filename has .beaki extension
  const finalFilename = filename.endsWith('.beaki') ? filename : `${filename}.beaki`
  
  // Create or get file handle
  const fileHandle = await handle.getFileHandle(finalFilename, { create: true })
  
  // Create writable stream
  const writable = await fileHandle.createWritable()
  
  // Write content
  await writable.write(content)
  
  // Close the file
  await writable.close()
}
