import os
import tkinter as tk

class FileMatcherUI:
    def __init__(self, targets, sources, title="File Alignment"):
        self.targets = targets
        self.sources = sources
        self.result = None
        
        self.target_map = {os.path.basename(t): t for t in targets}
        self.source_map = {os.path.basename(s): s for s in sources}
        
        self.root = tk.Toplevel()
        self.root.title(title)
        self.root.geometry("950x600")
        self.root.grab_set()
        
        main_frame = tk.Frame(self.root, padx=10, pady=10)
        main_frame.pack(fill=tk.BOTH, expand=True)

        tk.Label(main_frame, text=f"TARGET Files (Base Video)", font=("Arial", 10, "bold")).grid(row=0, column=0)
        tk.Label(main_frame, text=f"SOURCE Files (Audio/Subs to extract)", font=("Arial", 10, "bold")).grid(row=0, column=2)

        self.list_target = tk.Listbox(main_frame, width=55, height=25, selectmode=tk.SINGLE, exportselection=False)
        self.list_target.grid(row=1, column=0, rowspan=4, sticky="ns")
        
        sb_target = tk.Scrollbar(main_frame, command=self.list_target.yview)
        sb_target.grid(row=1, column=1, rowspan=4, sticky="ns")
        self.list_target.config(yscrollcommand=sb_target.set)

        self.list_source = tk.Listbox(main_frame, width=55, height=25, selectmode=tk.SINGLE, exportselection=False)
        self.list_source.grid(row=1, column=2, rowspan=4, sticky="ns")
        
        sb_source = tk.Scrollbar(main_frame, command=self.list_source.yview)
        sb_source.grid(row=1, column=3, rowspan=4, sticky="ns")
        self.list_source.config(yscrollcommand=sb_source.set)
        
        self.list_target.bind("<<ListboxSelect>>", lambda e: self.list_source.selection_clear(0, tk.END))
        self.list_source.bind("<<ListboxSelect>>", lambda e: self.list_target.selection_clear(0, tk.END))

        btn_frame = tk.Frame(main_frame)
        btn_frame.grid(row=1, column=4, rowspan=4, padx=10)
        tk.Button(btn_frame, text="▲", command=self.move_up, height=2, width=4).pack(pady=5)
        tk.Button(btn_frame, text="▼", command=self.move_down, height=2, width=4).pack(pady=5)
        tk.Button(btn_frame, text="X", command=self.remove_item, height=1, width=4, fg="red").pack(pady=20)

        for t in targets: self.list_target.insert(tk.END, os.path.basename(t))
        for s in sources: self.list_source.insert(tk.END, os.path.basename(s))

        tk.Button(self.root, text="CONFIRM PAIRING", command=self.confirm, bg="#4CAF50", fg="white", font=("Arial", 12, "bold")).pack(pady=10, fill=tk.X)
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def move_up(self):
        if self.list_target.curselection(): self._move_up_list(self.list_target)
        elif self.list_source.curselection(): self._move_up_list(self.list_source)

    def move_down(self):
        if self.list_target.curselection(): self._move_down_list(self.list_target)
        elif self.list_source.curselection(): self._move_down_list(self.list_source)

    def remove_item(self):
        if self.list_target.curselection(): self.list_target.delete(self.list_target.curselection()[0])
        elif self.list_source.curselection(): self.list_source.delete(self.list_source.curselection()[0])
            
    def _move_up_list(self, lbox):
        idx = lbox.curselection()
        if not idx or idx[0] == 0: return
        i = idx[0]
        text = lbox.get(i)
        lbox.delete(i)
        lbox.insert(i-1, text)
        lbox.selection_set(i-1)
        
    def _move_down_list(self, lbox):
        idx = lbox.curselection()
        if not idx or idx[0] == lbox.size() - 1: return
        i = idx[0]
        text = lbox.get(i)
        lbox.delete(i)
        lbox.insert(i+1, text)
        lbox.selection_set(i+1)

    def confirm(self):
        ordered_targets = self.list_target.get(0, tk.END)
        ordered_sources = self.list_source.get(0, tk.END)
        
        final_targets = []
        final_sources = []
        
        for name in ordered_targets:
            if name in self.target_map: final_targets.append(self.target_map[name])
                
        for name in ordered_sources:
            if name in self.source_map: final_sources.append(self.source_map[name])
        
        limit = min(len(final_targets), len(final_sources))
        self.result = list(zip(final_targets[:limit], final_sources[:limit]))
        self.root.destroy()
    
    def on_close(self):
        self.root.destroy()

def match_files_ui(target_list, source_list):
    if not target_list or not source_list:
        print("Empty file lists.")
        return []
    app = FileMatcherUI(target_list, source_list)
    app.root.wait_window()
    return app.result
