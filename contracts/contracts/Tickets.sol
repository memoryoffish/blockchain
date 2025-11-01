// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";  // 导入ERC721标准实现
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";  // 导入枚举扩展

contract Tickets is ERC721Enumerable {
    uint256 public nextTicketId;  // 下一个彩票ID
    address public admin;  // 管理员地址
    enum TicketStatus {Ended,Ongoing,Selling}  // 彩票状态枚举：已结束、进行中、出售中
    constructor() ERC721('Tickets', 'TIX') {  // 构造函灵：代币名称和符号
        admin = msg.sender;  // 设置部署者为管理员
    }
    struct TicketInfo {  // 彩票信息结构体
        uint256 activityId;  // 所属活动ID
        string choice;  // 选择的选项
        uint256 timestamp;  // 购买时间
        TicketStatus status;  // 彩票状态
    }
    struct winnerInfo {  // 获胜者信息结构体
        address[] owners;  // 持有者地址数组
        uint256[] counts;  // 每个持有者的彩票数量
        uint256 totalwintickets;  // 总获胜彩票数
    }
    struct refundInfo {  // 退款信息结构体
        address[] players;  // 玩家地址数组
        uint256[] counts;  // 每个玩家的彩票数量
    }
    // 新增：用户彩票详情
    struct UserTicketDetails {
        uint256 tokenId;  // 彩票代币ID
        uint256 activityId;  // 活动ID
        string choice;  // 选择
        uint256 timestamp;  // 时间戳
        TicketStatus status;  // 状态
    }
    // 新增：用户完整信息
    struct UserCompleteInfo {
        uint256 totalTickets;  // 总彩票数
        UserTicketDetails[] ticketDetails;  // 彩票详情数组
        TicketSaleInfo[] ticketSaleDetails;  // 在售彩票详情
        uint256[] ticketIds;  // 彩票ID数组
    }
    struct TicketSaleInfo {  // 销售信息结构体
        uint256 tokenId;  // 彩票ID
        uint256 value;  // 售价
    }
    struct TicketSaleReturninfo{  // 销售返回信息结构体
        uint256 tokenId;  // 彩票ID
        uint256 value;  // 售价
        address seller;  // 卖方地址
        uint256 activityId;  // 活动ID
        string choice;  // 选择
    }
    mapping(uint256 => TicketSaleInfo) public ticketsaleinfo;  // 彩票ID到销售信息的映射
    uint256[] ticketsonsale;  // 在售彩票ID数组
    mapping(uint256 => uint256) private ticketSaleIndex; // 新增:记录每个彩票在 ticketsonsale 中的索引
    mapping(uint256 => TicketInfo) public ticketInfo;  // 彩票ID到彩票信息的映射
    mapping(uint256 => mapping(string => uint256[])) public ticketsByActivityAndChoice;  // 按活动和选项索引
    mapping(uint256 => uint256[]) public ticketsByActivity;  // 按活动索引所有彩票
    // 铸造带有活动信息的票据
    function mintTicket(
        address to,  // 接收者地址
        uint256 activityId,  // 活动ID
        string memory choice,  // 选择
        uint256 number  // 数量
    ) external {
        for (uint256 i = 0; i < number; i++) {  // 循环铸造
            _mintSingleTicket(to, activityId, choice);  // 每次铸造一张
        }
    }
    function _mintSingleTicket(
        address to, 
        uint256 activityId, 
        string memory choice
    ) internal {
        uint256 tokenId = nextTicketId;  // 使用当前ID
        _safeMint(to, tokenId);  // 安全铸造
        
        // 存储票据信息
        ticketInfo[tokenId] = TicketInfo({  // 保存彩票信息
            activityId: activityId,
            choice: choice,
            timestamp: block.timestamp,
            status: TicketStatus.Ongoing
        });
        ticketsByActivityAndChoice[activityId][choice].push(tokenId);  // 添加到索引映射
        ticketsByActivity[activityId].push(tokenId);  // 添加到活动映射
        nextTicketId++;  // ID自增
    }
    function findwiners(
        uint256 activityId,
        string memory choice
    ) view external returns (winnerInfo memory) {  // 查找获胜者
        uint256[] memory winTickets = ticketsByActivityAndChoice[activityId][choice];  // 获取获胜彩票
        
        if (winTickets.length == 0) {  // 如果没有获胜彩票
            return winnerInfo(new address[](0), new uint256[](0), 0);  // 返回空信息
        }
        
        // 使用临时数组存储唯一拥有者
        address[] memory tempOwners = new address[](winTickets.length);  // 临时拥有者数组
        uint256[] memory tempCounts = new uint256[](winTickets.length);  // 临时数量数组
        uint256 uniqueCount = 0;  // 唯一拥有者计数
        
        for (uint256 i = 0; i < winTickets.length; i++) {  // 遍历所有获胜彩票
            address owner = ownerOf(winTickets[i]);  // 获取当前持有者
            
            // 查找现有拥有者
            bool found = false;
            for (uint256 j = 0; j < uniqueCount; j++) {  // 在已有拥有者中查找
                if (tempOwners[j] == owner) {  // 如果已存在
                    tempCounts[j]++;  // 数量加1
                    found = true;
                    break;
                }
            }
            
            // 如果是新拥有者
            if (!found) {  // 如果没有找到
                tempOwners[uniqueCount] = owner;  // 添加新拥有者
                tempCounts[uniqueCount] = 1;  // 设置数量为1
                uniqueCount++;  // 计数加1
            }
        }
        
        // 创建最终数组
        address[] memory owners = new address[](uniqueCount);  // 最终拥有者数组
        uint256[] memory counts = new uint256[](uniqueCount);  // 最终数量数组
        for (uint256 i = 0; i < uniqueCount; i++) {  // 复制到最终数组
            owners[i] = tempOwners[i];
            counts[i] = tempCounts[i];
        }
        
        return winnerInfo(owners, counts, winTickets.length);  // 返回获胜者信息
    }

    function findowners(uint256 activityId) view external returns (refundInfo memory) {  // 查找所有持有者
        uint256[] memory tickets = ticketsByActivity[activityId];  // 获取活动的所有彩票
        
        if (tickets.length == 0) {  // 如果没有彩票
            return refundInfo(new address[](0), new uint256[](0));  // 返回空信息
        }
        
        address[] memory tempOwners = new address[](tickets.length);  // 临时数组
        uint256[] memory tempCounts = new uint256[](tickets.length);
        uint256 uniqueCount = 0;  // 唯一持有者计数
        
        for (uint256 i = 0; i < tickets.length; i++) {  // 遍历所有彩票
            address owner = ownerOf(tickets[i]);  // 获取持有者
            
            // 查找现有拥有者
            bool found = false;
            for (uint256 j = 0; j < uniqueCount; j++) {
                if (tempOwners[j] == owner) {  // 如果已存在
                    tempCounts[j]++;  // 数量加1
                    found = true;
                    break;
                }
            }
            
            // 如果是新拥有者
            if (!found) {  // 如果没有找到
                tempOwners[uniqueCount] = owner;
                tempCounts[uniqueCount] = 1;
                uniqueCount++;  // 计数加1
            }
        }
        
        // 创建最终数组
        address[] memory owners = new address[](uniqueCount);
        uint256[] memory counts = new uint256[](uniqueCount);
        for (uint256 i = 0; i < uniqueCount; i++) {  // 复制数据
            owners[i] = tempOwners[i];
            counts[i] = tempCounts[i];
        }
        
        return refundInfo(owners, counts);  // 返回持有者信息
    }
    
    // 新增：获取用户所有彩票信息
    function getUserTickets(address user) external view returns (UserCompleteInfo memory) {
        uint256 balance = balanceOf(user);  // 获取用户持有的彩票数量
        
        UserTicketDetails[] memory details = new UserTicketDetails[](balance);  // 创建详情数组
        uint256[] memory tokenIds = new uint256[](balance);  // 创建ID数组
        TicketSaleInfo[] memory saleDetails = new TicketSaleInfo[](balance);
        uint256 saleCount = 0;  // 在售彩票计数
        for (uint256 i = 0; i < balance; i++) {  // 遍历用户的所有彩票
            uint256 tokenId = tokenOfOwnerByIndex(user, i);  // 获取第i张彩票的ID
            TicketInfo memory info = ticketInfo[tokenId];  // 获取彩票信息
            
            details[i] = UserTicketDetails({  // 填充详情
                tokenId: tokenId,
                activityId: info.activityId,
                choice: info.choice,
                timestamp: info.timestamp,
                status: info.status
            });
            if(isTicketForSale(tokenId)){  // 如果在售
                saleDetails[saleCount] = ticketsaleinfo[tokenId];  // 添加销售信息
                saleCount++;  // 计数加1
            }   
            tokenIds[i] = tokenId;  // 保存ID
        }
        
        return UserCompleteInfo({  // 返回完整信息
            totalTickets: balance,
            ticketDetails: details,
            ticketSaleDetails: saleDetails,
            ticketIds: tokenIds
        });
    }
    
    // 新增：获取用户在特定活动中的彩票
    function getUserTicketsByActivity(address user, uint256 activityId) 
        external view returns (UserTicketDetails[] memory) {
        
        uint256 balance = balanceOf(user);  // 获取用户总彩票数
        UserTicketDetails[] memory tempDetails = new UserTicketDetails[](balance);  // 临时数组
        uint256 count = 0;  // 计数器
        
        for (uint256 i = 0; i < balance; i++) {  // 遍历所有彩票
            uint256 tokenId = tokenOfOwnerByIndex(user, i);
            TicketInfo memory info = ticketInfo[tokenId];
            
            if (info.activityId == activityId) {  // 如果属于指定活动
                tempDetails[count] = UserTicketDetails({  // 添加到结果
                    tokenId: tokenId,
                    activityId: info.activityId,
                    choice: info.choice,
                    timestamp: info.timestamp,
                    status: info.status
                });
                count++;  // 计数加1
            }
        }
        
        // 创建正确大小的数组
        UserTicketDetails[] memory details = new UserTicketDetails[](count);  // 最终数组
        for (uint256 i = 0; i < count; i++) {
            details[i] = tempDetails[i];  // 复制数据
        }
        
        return details;  // 返回结果
    }
    
    // 新增：获取用户的彩票数量
    function getUserTicketCount(address user) external view returns (uint256) {
        return balanceOf(user);  // 返回余额
    }
    function getallticketsonsale() external view returns (uint256[] memory) {  // 获取所有在售彩票ID
        return ticketsonsale;  // 返回在售数组
    }
    function getallticketsonsaleReturninfo() external view returns (TicketSaleReturninfo[] memory) {  // 获取在售信息
        uint256 len = ticketsonsale.length;  // 在售数量
        TicketSaleReturninfo[] memory infos = new TicketSaleReturninfo[](len);  // 创建数组
        for (uint256 i = 0; i < len; i++) {  // 遍历所有在售彩票
            uint256 tokenId = ticketsonsale[i];
            TicketInfo memory info = ticketInfo[tokenId];  // 获取彩票信息
            TicketSaleInfo memory saleInfo = ticketsaleinfo[tokenId];  // 获取销售信息
            infos[i] = TicketSaleReturninfo({  // 填充返回信息
                tokenId: tokenId,
                value: saleInfo.value,
                activityId: info.activityId,
                choice: info.choice,
                seller: ownerOf(tokenId)
            });
        }
        return infos;  // 返回完整信息
    }
    function tickettransfer(address to, uint256 tokenId) external {  // 转移彩票
        _transfer(ownerOf(tokenId), to, tokenId);  // 执行转移
        ticketInfo[tokenId].status = TicketStatus.Ongoing;  // 更改状态
        _delistticketsaleinfo(tokenId);  // 从在售列表中移除
    }
    function delistticketsaleinfo(uint256 tokenId) external {  // 下架彩票
        _delistticketsaleinfo(tokenId);  // 调用内部函数
    }

    function _delistticketsaleinfo(uint256 tokenId) internal {
        require(msg.sender == admin||msg.sender == ownerOf(tokenId), 'only admin can delist');  // 权限验证
        ticketInfo[tokenId].status = TicketStatus.Ongoing;  // 更改状态
        delete ticketsaleinfo[tokenId];  // 删除销售信息
        _removeFromSaleArray(tokenId);  // 从数组中移除
    }
    // 检查彩票是否在售
    function isTicketForSale(uint256 tokenId) internal view returns (bool) {
        return ticketInfo[tokenId].status == TicketStatus.Selling;  // 判断状态
    }
    
    // 获取彩票售价
    function getTicketPrice(uint256 tokenId) external view returns (uint256) {
        return ticketsaleinfo[tokenId].value;  // 返回售价
    }
    function ActivityEnded(uint256 activityId) external {  // 活动结束处理
        uint256[] memory tickets = ticketsByActivity[activityId];  // 获取活动所有彩票
        for (uint256 i = 0; i < tickets.length; i++) {  // 遍历所有彩票
            if(isTicketForSale(tickets[i])){  // 如果在售
                _delistticketsaleinfo(tickets[i]);  // 下架处理
            }
            ticketInfo[tickets[i]].status = TicketStatus.Ended;  // 设置为已结束
        }
        
    }
    function sellTicket(uint256 tokenId, uint256 price) external {  // 上架销售
        require(msg.sender == ownerOf(tokenId), 'only owner can sell');  // 验证所有者
        ticketsaleinfo[tokenId] = TicketSaleInfo({  // 设置销售信息
            tokenId: tokenId,
            value: price
        });
        ticketInfo[tokenId].status = TicketStatus.Selling;  // 更改状态
        ticketsonsale.push(tokenId);  // 添加到在售数组
        ticketSaleIndex[tokenId] = ticketsonsale.length - 1; // 记录索引
    }
    function _removeFromSaleArray(uint256 tokenId) private {  // 从数组移除
        uint256 index = ticketSaleIndex[tokenId];  // 获取索引
        uint256 lastIndex = ticketsonsale.length - 1;  // 最后一个元素索引
        
        // 如果不是最后一个元素,将最后一个元素移到当前位置
        if (index != lastIndex) {  // 如果不在末尾
            uint256 lastTokenId = ticketsonsale[lastIndex];  // 获取最后一个
            ticketsonsale[index] = lastTokenId;  // 移到当前位置
            ticketSaleIndex[lastTokenId] = index; // 更新被移动元素的索引
        }
        
        // 移除最后一个元素
        ticketsonsale.pop();  // 删除最后一个
        delete ticketSaleIndex[tokenId];  // 删除索引映射
    }
}
