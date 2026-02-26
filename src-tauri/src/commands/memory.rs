/// 记忆文件管理命令
use std::fs;
use std::io::Write;
use std::path::PathBuf;

fn openclaw_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_default()
        .join(".openclaw")
}

fn memory_dir(category: &str) -> PathBuf {
    match category {
        "memory" => openclaw_dir().join("workspace").join("memory"),
        "archive" => openclaw_dir().join("workspace-memory"),
        "core" => openclaw_dir().join("workspace"),
        _ => openclaw_dir().join("workspace").join("memory"),
    }
}

#[tauri::command]
pub fn list_memory_files(category: String) -> Result<Vec<String>, String> {
    let dir = memory_dir(&category);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut files = Vec::new();
    collect_files(&dir, &dir, &mut files, &category)?;
    files.sort();
    Ok(files)
}

fn collect_files(
    base: &PathBuf,
    dir: &PathBuf,
    files: &mut Vec<String>,
    category: &str,
) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("读取目录失败: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            // core 类别只读根目录的 .md 文件
            if category != "core" {
                collect_files(base, &path, files, category)?;
            }
        } else {
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if matches!(ext, "md" | "txt" | "json" | "jsonl") {
                let rel = path.strip_prefix(base)
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|_| path.to_string_lossy().to_string());
                files.push(rel);
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn read_memory_file(path: String) -> Result<String, String> {
    // 安全检查：路径不能包含 ..
    if path.contains("..") {
        return Err("非法路径".to_string());
    }

    // 尝试在各个记忆目录下查找
    let candidates = [
        memory_dir("memory").join(&path),
        memory_dir("archive").join(&path),
        memory_dir("core").join(&path),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return fs::read_to_string(candidate)
                .map_err(|e| format!("读取失败: {e}"));
        }
    }

    Err(format!("文件不存在: {path}"))
}

#[tauri::command]
pub fn write_memory_file(path: String, content: String) -> Result<(), String> {
    if path.contains("..") {
        return Err("非法路径".to_string());
    }

    let candidates = [
        memory_dir("memory").join(&path),
        memory_dir("archive").join(&path),
        memory_dir("core").join(&path),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return fs::write(candidate, &content)
                .map_err(|e| format!("写入失败: {e}"));
        }
    }

    // 默认写入 memory 目录
    let target = memory_dir("memory").join(&path);
    if let Some(parent) = target.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&target, &content)
        .map_err(|e| format!("写入失败: {e}"))
}

#[tauri::command]
pub fn delete_memory_file(path: String) -> Result<(), String> {
    if path.contains("..") {
        return Err("非法路径".to_string());
    }

    let candidates = [
        memory_dir("memory").join(&path),
        memory_dir("archive").join(&path),
        memory_dir("core").join(&path),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return fs::remove_file(candidate)
                .map_err(|e| format!("删除失败: {e}"));
        }
    }

    Err(format!("文件不存在: {path}"))
}

#[tauri::command]
pub fn export_memory_zip(category: String) -> Result<String, String> {
    let dir = memory_dir(&category);
    if !dir.exists() {
        return Err("目录不存在".to_string());
    }

    let mut files = Vec::new();
    collect_files(&dir, &dir, &mut files, &category)?;
    if files.is_empty() {
        return Err("没有可导出的文件".to_string());
    }

    let tmp_dir = std::env::temp_dir();
    let zip_name = format!(
        "openclaw-{}-{}.zip",
        category,
        chrono::Local::now().format("%Y%m%d-%H%M%S")
    );
    let zip_path = tmp_dir.join(&zip_name);

    let file = fs::File::create(&zip_path)
        .map_err(|e| format!("创建 zip 失败: {e}"))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    for rel_path in &files {
        let full_path = dir.join(rel_path);
        let content = fs::read_to_string(&full_path)
            .map_err(|e| format!("读取 {rel_path} 失败: {e}"))?;
        zip.start_file(rel_path, options)
            .map_err(|e| format!("写入 zip 失败: {e}"))?;
        zip.write_all(content.as_bytes())
            .map_err(|e| format!("写入内容失败: {e}"))?;
    }

    zip.finish().map_err(|e| format!("完成 zip 失败: {e}"))?;
    Ok(zip_path.to_string_lossy().to_string())
}
