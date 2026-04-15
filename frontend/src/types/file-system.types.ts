export interface FileStructure {
  path: string;
  content: string;
  type: 'file' | 'folder';
  is_binary?: boolean;
  isLoaded?: boolean;
  children?: FileStructure[];
}
