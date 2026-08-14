//! 端口分配工具
//! 找一个可用的随机端口

use std::net::TcpListener;

/// 获取一个可用的随机端口
pub fn find_available_port() -> Result<u16, std::io::Error> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    Ok(port)
}

/// 检查指定端口是否可用
pub fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_available_port() {
        let port = find_available_port().unwrap();
        assert!(port > 1024);
        assert!(is_port_available(port));
    }
}
