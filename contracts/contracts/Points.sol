// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";  // 导入OpenZeppelin的ERC20标准实现

contract Points is ERC20 {
    address public admin;  // 管理员地址
    uint256 public constant AIRDROP_AMOUNT = 10000;  // 空投数量常量
    mapping(address => bool) public hasClaimedAirdrop;  // 记录用户是否已领取空投
    
    constructor() ERC20("Points", "PTS") {  // 构造函灵：代币名称和符号
        admin = msg.sender;  // 设置部署者为管理员
    }
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");  // 只有管理员可以调用
        _;
    }
    
    // 空投函数
    function airdrop() external {
        require(!hasClaimedAirdrop[msg.sender], "Airdrop already claimed");  // 防止重复领取
        hasClaimedAirdrop[msg.sender] = true;  // 标记为已领取
        _mint(msg.sender, AIRDROP_AMOUNT);  // 铸造代币给用户
    }
    
    // 管理员铸造函数
    function mint(address to, uint256 amount) external onlyAdmin {  // 管理员铸造代币
        _mint(to, amount);  // 调用内部铸造函数
    }

    // 管理员销毁函数
    function burn(address from, uint256 amount) external onlyAdmin {  // 管理员销毁代币
        _burn(from, amount);  // 调用内部销毁函数
    }
}
