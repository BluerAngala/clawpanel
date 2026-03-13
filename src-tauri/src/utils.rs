#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// 跨平台获取 openclaw 命令的方法（同步版本）
/// 在 Windows 上使用 `cmd /c openclaw` 以兼容全局 npm 路径下的 `.cmd` 脚本
#[allow(dead_code)]
pub fn openclaw_command() -> std::process::Command {
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut cmd = std::process::Command::new("cmd");
        cmd.arg("/c").arg("openclaw");
        cmd.env("PATH", crate::commands::enhanced_path());
        cmd.stdout(std::process::Stdio::null());
        cmd.stderr(std::process::Stdio::null());
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd
    }
    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = std::process::Command::new("openclaw");
        cmd.env("PATH", crate::commands::enhanced_path());
        cmd
    }
}

/// 异步版本的 openclaw 命令（推荐使用，避免阻塞 UI）
pub fn openclaw_command_async() -> tokio::process::Command {
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut cmd = tokio::process::Command::new("cmd");
        cmd.arg("/c").arg("openclaw");
        cmd.env("PATH", crate::commands::enhanced_path());
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd
    }
    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = tokio::process::Command::new("openclaw");
        cmd.env("PATH", crate::commands::enhanced_path());
        cmd
    }
}
