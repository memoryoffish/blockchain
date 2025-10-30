// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Points is ERC20 {
    address public admin;
    uint256 public constant AIRDROP_AMOUNT = 10000;
    mapping(address => bool) public hasClaimedAirdrop;
    
    constructor() ERC20("Points", "PTS") {
        admin = msg.sender;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }
    
    // 空投函数
    function airdrop() external {
        require(!hasClaimedAirdrop[msg.sender], "Airdrop already claimed");
        hasClaimedAirdrop[msg.sender] = true;
        _mint(msg.sender, AIRDROP_AMOUNT);
    }
    
    // 管理员铸造函数
    function mint(address to, uint256 amount) external onlyAdmin {
        _mint(to, amount);
    }

    // 管理员销毁函数
    function burn(address from, uint256 amount) external onlyAdmin {
        _burn(from, amount);
    }
}