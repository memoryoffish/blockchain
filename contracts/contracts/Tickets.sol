// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract Tickets is ERC721Enumerable {
    uint256 public nextTicketId;
    address public admin;
    enum TicketStatus {Ended,Ongoing,Selling}
    constructor() ERC721('Tickets', 'TIX') {
        admin = msg.sender;
    }
    struct TicketInfo {
        uint256 activityId;
        string choice;
        uint256 timestamp;
        TicketStatus status;
    }
    struct winnerInfo {
        address[] owners;
        uint256[] counts;
        uint256 totalwintickets;
    }
    struct refundInfo {
        address[] players;
        uint256[] counts;    
    }
    // 新增：用户彩票详情
    struct UserTicketDetails {
        uint256 tokenId;
        uint256 activityId;
        string choice;
        uint256 timestamp;
        TicketStatus status;
    }
    // 新增：用户完整信息
    struct UserCompleteInfo {
        uint256 totalTickets;
        UserTicketDetails[] ticketDetails;
        TicketSaleInfo[] ticketSaleDetails;
        uint256[] ticketIds;
    }
    struct TicketSaleInfo {
        uint256 tokenId;
        uint256 value;
    }
    struct TicketSaleReturninfo{
        uint256 tokenId;
        uint256 value;
        address seller;
        uint256 activityId;
        string choice;
    }
    mapping(uint256 => TicketSaleInfo) public ticketsaleinfo;
    uint256[] ticketsonsale;
    mapping(uint256 => uint256) private ticketSaleIndex; // 新增:记录每个彩票在 ticketsonsale 中的索引
    mapping(uint256 => TicketInfo) public ticketInfo;
    mapping(uint256 => mapping(string => uint256[])) public ticketsByActivityAndChoice;
    mapping(uint256 => uint256[]) public ticketsByActivity;
    // 铸造带有活动信息的票据
    function mintTicket(
        address to, 
        uint256 activityId, 
        string memory choice,
        uint256 number
    ) external {
        for (uint256 i = 0; i < number; i++) {
            _mintSingleTicket(to, activityId, choice);
        }
    }
    function _mintSingleTicket(
        address to, 
        uint256 activityId, 
        string memory choice
    ) internal {
        uint256 tokenId = nextTicketId;
        _safeMint(to, tokenId);
        
        // 存储票据信息
        ticketInfo[tokenId] = TicketInfo({
            activityId: activityId,
            choice: choice,
            timestamp: block.timestamp,
            status: TicketStatus.Ongoing
        });
        ticketsByActivityAndChoice[activityId][choice].push(tokenId);
        ticketsByActivity[activityId].push(tokenId);
        nextTicketId++;
    }
    function findwiners(
        uint256 activityId,
        string memory choice
    ) view external returns (winnerInfo memory) {
        uint256[] memory winTickets = ticketsByActivityAndChoice[activityId][choice];
        
        if (winTickets.length == 0) {
            return winnerInfo(new address[](0), new uint256[](0), 0);
        }
        
        // 使用临时数组存储唯一拥有者
        address[] memory tempOwners = new address[](winTickets.length);
        uint256[] memory tempCounts = new uint256[](winTickets.length);
        uint256 uniqueCount = 0;
        
        for (uint256 i = 0; i < winTickets.length; i++) {
            address owner = ownerOf(winTickets[i]);
            
            // 查找现有拥有者
            bool found = false;
            for (uint256 j = 0; j < uniqueCount; j++) {
                if (tempOwners[j] == owner) {
                    tempCounts[j]++;
                    found = true;
                    break;
                }
            }
            
            // 如果是新拥有者
            if (!found) {
                tempOwners[uniqueCount] = owner;
                tempCounts[uniqueCount] = 1;
                uniqueCount++;
            }
        }
        
        // 创建最终数组
        address[] memory owners = new address[](uniqueCount);
        uint256[] memory counts = new uint256[](uniqueCount);
        for (uint256 i = 0; i < uniqueCount; i++) {
            owners[i] = tempOwners[i];
            counts[i] = tempCounts[i];
        }
        
        return winnerInfo(owners, counts, winTickets.length);
    }

    function findowners(uint256 activityId) view external returns (refundInfo memory) {
        uint256[] memory tickets = ticketsByActivity[activityId];
        
        if (tickets.length == 0) {
            return refundInfo(new address[](0), new uint256[](0));
        }
        
        address[] memory tempOwners = new address[](tickets.length);
        uint256[] memory tempCounts = new uint256[](tickets.length);
        uint256 uniqueCount = 0;
        
        for (uint256 i = 0; i < tickets.length; i++) {
            address owner = ownerOf(tickets[i]);
            
            // 查找现有拥有者
            bool found = false;
            for (uint256 j = 0; j < uniqueCount; j++) {
                if (tempOwners[j] == owner) {
                    tempCounts[j]++;
                    found = true;
                    break;
                }
            }
            
            // 如果是新拥有者
            if (!found) {
                tempOwners[uniqueCount] = owner;
                tempCounts[uniqueCount] = 1;
                uniqueCount++;
            }
        }
        
        // 创建最终数组
        address[] memory owners = new address[](uniqueCount);
        uint256[] memory counts = new uint256[](uniqueCount);
        for (uint256 i = 0; i < uniqueCount; i++) {
            owners[i] = tempOwners[i];
            counts[i] = tempCounts[i];
        }
        
        return refundInfo(owners, counts);
    }
    
    // 新增：获取用户所有彩票信息
    function getUserTickets(address user) external view returns (UserCompleteInfo memory) {
        uint256 balance = balanceOf(user);
        
        UserTicketDetails[] memory details = new UserTicketDetails[](balance);
        uint256[] memory tokenIds = new uint256[](balance);
        TicketSaleInfo[] memory saleDetails = new TicketSaleInfo[](balance);
        uint256 saleCount = 0;
        for (uint256 i = 0; i < balance; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(user, i);
            TicketInfo memory info = ticketInfo[tokenId];
            
            details[i] = UserTicketDetails({
                tokenId: tokenId,
                activityId: info.activityId,
                choice: info.choice,
                timestamp: info.timestamp,
                status: info.status
            });
            if(isTicketForSale(tokenId)){
                saleDetails[saleCount] = ticketsaleinfo[tokenId];
                saleCount++;
            }   
            tokenIds[i] = tokenId;
        }
        
        return UserCompleteInfo({
            totalTickets: balance,
            ticketDetails: details,
            ticketSaleDetails: saleDetails,
            ticketIds: tokenIds
        });
    }
    
    // 新增：获取用户在特定活动中的彩票
    function getUserTicketsByActivity(address user, uint256 activityId) 
        external view returns (UserTicketDetails[] memory) {
        
        uint256 balance = balanceOf(user);
        UserTicketDetails[] memory tempDetails = new UserTicketDetails[](balance);
        uint256 count = 0;
        
        for (uint256 i = 0; i < balance; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(user, i);
            TicketInfo memory info = ticketInfo[tokenId];
            
            if (info.activityId == activityId) {
                tempDetails[count] = UserTicketDetails({
                    tokenId: tokenId,
                    activityId: info.activityId,
                    choice: info.choice,
                    timestamp: info.timestamp,
                    status: info.status
                });
                count++;
            }
        }
        
        // 创建正确大小的数组
        UserTicketDetails[] memory details = new UserTicketDetails[](count);
        for (uint256 i = 0; i < count; i++) {
            details[i] = tempDetails[i];
        }
        
        return details;
    }
    
    // 新增：获取用户的彩票数量
    function getUserTicketCount(address user) external view returns (uint256) {
        return balanceOf(user);
    }
    function getallticketsonsale() external view returns (uint256[] memory) {
        return ticketsonsale;
    }
    function getallticketsonsaleReturninfo() external view returns (TicketSaleReturninfo[] memory) {
        uint256 len = ticketsonsale.length;
        TicketSaleReturninfo[] memory infos = new TicketSaleReturninfo[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 tokenId = ticketsonsale[i];
            TicketInfo memory info = ticketInfo[tokenId];
            TicketSaleInfo memory saleInfo = ticketsaleinfo[tokenId];
            infos[i] = TicketSaleReturninfo({
                tokenId: tokenId,
                value: saleInfo.value,
                activityId: info.activityId,
                choice: info.choice,
                seller: ownerOf(tokenId)
            });
        }
        return infos;
    }
    function tickettransfer(address to, uint256 tokenId) external {
        _transfer(ownerOf(tokenId), to, tokenId);
        ticketInfo[tokenId].status = TicketStatus.Ongoing;
        _delistticketsaleinfo(tokenId);
    }
    function delistticketsaleinfo(uint256 tokenId) external {
        _delistticketsaleinfo(tokenId);
    }

    function _delistticketsaleinfo(uint256 tokenId) internal {
        require(msg.sender == admin||msg.sender == ownerOf(tokenId), 'only admin can delist');
        ticketInfo[tokenId].status = TicketStatus.Ongoing;
        delete ticketsaleinfo[tokenId];
        _removeFromSaleArray(tokenId);
    }
    // 检查彩票是否在售
    function isTicketForSale(uint256 tokenId) internal view returns (bool) {
        return ticketInfo[tokenId].status == TicketStatus.Selling;
    }
    
    // 获取彩票售价
    function getTicketPrice(uint256 tokenId) external view returns (uint256) {
        return ticketsaleinfo[tokenId].value;
    }
    function ActivityEnded(uint256 activityId) external {
        uint256[] memory tickets = ticketsByActivity[activityId];
        for (uint256 i = 0; i < tickets.length; i++) {
            if(isTicketForSale(tickets[i])){
                _delistticketsaleinfo(tickets[i]);
            }
            ticketInfo[tickets[i]].status = TicketStatus.Ended;
        }
        
    }
    function sellTicket(uint256 tokenId, uint256 price) external {
        require(msg.sender == ownerOf(tokenId), 'only owner can sell');
        ticketsaleinfo[tokenId] = TicketSaleInfo({
            tokenId: tokenId,
            value: price
        });
        ticketInfo[tokenId].status = TicketStatus.Selling;
        ticketsonsale.push(tokenId);
        ticketSaleIndex[tokenId] = ticketsonsale.length - 1; // 记录索引
    }
    function _removeFromSaleArray(uint256 tokenId) private {
        uint256 index = ticketSaleIndex[tokenId];
        uint256 lastIndex = ticketsonsale.length - 1;
        
        // 如果不是最后一个元素,将最后一个元素移到当前位置
        if (index != lastIndex) {
            uint256 lastTokenId = ticketsonsale[lastIndex];
            ticketsonsale[index] = lastTokenId;
            ticketSaleIndex[lastTokenId] = index; // 更新被移动元素的索引
        }
        
        // 移除最后一个元素
        ticketsonsale.pop();
        delete ticketSaleIndex[tokenId];
    }
}