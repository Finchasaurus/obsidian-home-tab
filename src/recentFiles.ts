import { Component, type App, TFile, TAbstractFile } from "obsidian";
import { get } from "svelte/store";
import type HomeTab from "./main";
import type { HomeTabSettings } from "./settings";
import { recentFiles } from "./store";

export interface recentFile{
    file: TFile,
    timestamp: number,
}

export interface recentFileStore{
    filepath: string,
    timestamp: number,
}

export class RecentFileManager extends Component{
    private app: App
    private plugin: HomeTab
    private pluginSettings: HomeTabSettings

    private recentFilesPath: string;


    constructor(app: App, plugin: HomeTab){
        super()
        this.app = app
        this.plugin = plugin
        this.pluginSettings = plugin.settings
        this.recentFilesPath = `${this.plugin.manifest.dir}/recentFiles.json`

        
        this.loadStoredRecentFiles()
    }
    
    onload(): void {
        this.registerEvent(this.app.workspace.on('file-open', async (file) => {this.updateRecentFiles(file); await this.storeRecentFiles()})) // Save file to recent files list on opening
        this.registerEvent(this.app.vault.on('delete', async (file) => {file instanceof TFile ? this.removeRecentFile(file) : null; await this.storeRecentFiles()})) // Remove recent file if deleted
        this.registerEvent(this.app.vault.on('rename',  (file) => file instanceof TFile ? this.onFileRename() : null)) // Update displayed name on file rename

    }

    private updateRecentFiles(openedFile: TFile | null): void{
        if(openedFile){
            recentFiles.update((filesArray) => {
                // If file is already in the recent files list update only the timestamp
                if(filesArray.some((item) => item.file === openedFile)){
                    const itemIndex = filesArray.findIndex((item) => item.file === openedFile)
                    filesArray[itemIndex].timestamp = Date.now()
                }
                // If the recent files list is full replace the last (oldest) item
                else if(filesArray.length >= this.pluginSettings.maxRecentFiles){
                    filesArray[filesArray.length - 1] = {
                        file: openedFile,
                        timestamp: Date.now()
                    }
                }
                // If there is space and the file is not already in the recent files list add it
                else{
                    filesArray.push({
                        file: openedFile,
                        timestamp: Date.now(),
                    })
                }
                // Sort files by descending (new to old) opening time
                return filesArray.sort((a,b) => b.timestamp - a.timestamp)
            })
        }
    }
    
    removeRecentFile(file: TFile): void{
        recentFiles.update((filesArray) => {
            filesArray.splice(filesArray.findIndex((recentFile) => recentFile.file == file), 1)
            return filesArray
        })

        this.storeRecentFiles()
    }

    onNewMaxListLenght(newValue: number){
        const currentLenght = get(recentFiles).length
        if(newValue < currentLenght){
            this.removeRecentFiles(currentLenght - newValue)
        }
    }

    private removeRecentFiles(number: number){
        recentFiles.update((filesArray) => {
            filesArray.splice(filesArray.length - number, number)
            return filesArray
        })
        
        this.storeRecentFiles()
    }

    private onFileRename(): void{
        // Trigger refresh of svelte component, not sure if it's the best approach
        recentFiles.update((filesArray) => filesArray)
    }

    private async storeRecentFiles(): Promise<void>{
        const storeObj = get(recentFiles).map((item) => ({filepath: item.file.path, timestamp: item.timestamp}))

        const data = JSON.stringify(storeObj, null, 2)
        await this.app.vault.adapter.write(this.recentFilesPath, data)
    }

    private async loadStoredRecentFiles(): Promise<void>{
       const exists = await this.app.vault.adapter.exists(this.recentFilesPath)
    if (!exists) return

    const data = await this.app.vault.adapter.read(this.recentFilesPath)
    const storedFiles = JSON.parse(data) as recentFileStore[]
    const filesToLoad: recentFile[] = []

    storedFiles.forEach((item) => {
        const file = this.app.vault.getAbstractFileByPath(item.filepath)
        if (file && file instanceof TFile) {
            filesToLoad.push({ file, timestamp: item.timestamp })
        }
    })
        recentFiles.set(filesToLoad)
    }
}

