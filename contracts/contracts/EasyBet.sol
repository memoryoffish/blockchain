// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

// Uncomment the line to use openzeppelin/ERC721,ERC20
// You can use this dependency directly because it has been installed by TA already
// import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Uncomment this line to use console.log
import "hardhat/console.sol";
import "./Tickets.sol";  // 导入彩票合约，用于管理ERC721代币
import "./Points.sol";   // 导入积分合约，用于管理ERC20代币
contract EasyBet {
    address public manager; // 管理员，用来开奖和退款   
    // use a event if you want
    // to represent time you can choose block.timestamp
    Points public pointsManager;    // 积分管理器实例
    Tickets public ticketsManager;  // 彩票管理器实例
    modifier onlyManager {
        require(msg.sender == manager);  // 只有管理员可以调用
        _;
    }
    enum ActivityStatus { NotStarted, Ongoing, Ended,Finished }  // 活动状态枚举：未开始、进行中、已结束、已完成
    // maybe you need a struct to store some activity information
    struct GameRound {
        uint256 id;
        address[]  players; // 玩家
        string name;
        string description;
        mapping(address => bool) hasJoined; // 记录玩家是否已参与
        address  winner; // 胜者
        string[] choices;  // 竞猜选项数组
        uint256 startTime;  // 活动开始时间
        uint256 endTime;
        uint256 amountperticket;
        uint256 totalAmount; // 奖池总共金额
        ActivityStatus status;
    }
    struct GameRoundBack{  // 活动返回信息的结构体，用于前端展示
        uint256 id;
        string name;
        string[] choices;
        uint256 startTime;
        string description;
        uint256 amountperticket;
        uint256 endTime;
        uint256 totalAmount;
        ActivityStatus status;
    }
    mapping(uint256 => GameRound) public GameRoundsPool;  // 活动ID到活动信息的映射
    uint256 public gameRoundCount;  // 活动计数器
    
    constructor() {
        manager = msg.sender;  // 设置部署者为管理员
        pointsManager = new Points();    // 创建积分合约实例
        ticketsManager = new Tickets();  // 创建彩票合约实例
    }

    function getAddress() view external returns(address){  // 获取合约地址
        return address(this);
    }
    function getPlayerNumber(uint256 activityId) view external returns (uint256){  // 获取活动的玩家数量
        return GameRoundsPool[activityId].players.length;
    }

    function play(string memory choice, uint256 activityId,uint256 number) public {  // 用户购买彩票
        GameRound storage round = GameRoundsPool[activityId];
        require(round.status==ActivityStatus.Ongoing, "Activity has not started yet");  // 验证活动进行中
        require(validchoice(choice, round.choices), "Invalid choice");  // 验证选项有效
        require(pointsManager.balanceOf(msg.sender) >= round.amountperticket, "Not enough points");  // 验证积分足够
        bool ok= pointsManager.transferFrom(msg.sender, address(this), round.amountperticket*number);  // 转移积分
        require(ok, "TransferFrom failed");  
        if (!round.hasJoined[msg.sender]) {  // 如果是新玩家
            round.players.push(msg.sender); // 只有未参与的玩家才添加
            round.hasJoined[msg.sender] = true; // 标记为已参与
        }
        ticketsManager.mintTicket(msg.sender, activityId, choice,number);  // 铸造彩票
        round.totalAmount += round.amountperticket*number;  // 更新奖池总额
    }

    function createGameRound(  // 管理员创建活动
        string memory name,
        string memory description,
        string[] memory choices,
        uint256 startTime,
        uint256 endTime,
        uint256 amountperticket,
        uint256 totalAmount
    ) onlyManager public {
        require(startTime < endTime, "Start time must be before end time");  // 验证时间合理
        require(endTime > block.timestamp, "End time must be in the future");
        // 创建一个空的 GameRound
        GameRound storage newRound = GameRoundsPool[gameRoundCount];
        newRound.id = gameRoundCount;
        newRound.name = name;
        newRound.description = description;
        newRound.choices = choices;  // 设置选项
        newRound.startTime = startTime;
        newRound.endTime = endTime;
        newRound.amountperticket = amountperticket;
        newRound.totalAmount = totalAmount;
        if (block.timestamp >= startTime) {  // 根据当前时间设置状态
            newRound.status = ActivityStatus.Ongoing;
        } else {
            newRound.status = ActivityStatus.NotStarted;
        }
        pointsManager.mint(address(this), totalAmount);  // 为奖池铸造积分
        gameRoundCount++;  // 活动数量自增
    }
    function getAllGameRounds() public view returns (GameRoundBack[] memory) {  // 获取所有活动信息
        GameRoundBack[] memory rounds = new GameRoundBack[](gameRoundCount);
        for (uint256 i = 0; i < gameRoundCount; i++) {
            GameRound storage round = GameRoundsPool[i];
            rounds[i] = GameRoundBack({  // 填充活动信息
                id: round.id,
                name: round.name,
                description: round.description,
                choices: round.choices,
                startTime: round.startTime,
                endTime: round.endTime,
                totalAmount: round.totalAmount,
                status: round.status,
                amountperticket: round.amountperticket
            });
        }
        return rounds;
    }
    function draw(string memory choice, uint256 activityId) onlyManager public {  // 管理员开奖
        GameRound storage round = GameRoundsPool[activityId];
        require(round.status!=ActivityStatus.Ended, "Activity has already ended");  // 验证活动未结束
        Tickets.winnerInfo memory info = ticketsManager.findwiners(activityId, choice);  // 查找获胜者
        if (info.totalwintickets==0){  // 如果没有获胜彩票
            ticketsManager.ActivityEnded(activityId);  // 结束活动
            round.status = ActivityStatus.Finished;
            return;
        }
        uint256 singletickterwinamount = round.totalAmount / info.totalwintickets;  // 计算单张彩票奖金
        for (uint i = 0; i < info.owners.length; i++) {  // 遍历所有获胜者
            bool success = pointsManager.transfer(info.owners[i], info.counts[i] * singletickterwinamount);  // 分配奖金
            require(success, "Transfer failed");
        }
        ticketsManager.ActivityEnded(activityId);  // 结束所有相关彩票
        round.status = ActivityStatus.Finished;
    }

    function refund(uint256 activityId) onlyManager public {  // 管理员退款
        GameRound storage round = GameRoundsPool[activityId];
        require(round.status!=ActivityStatus.Ended, "Activity has already ended");  // 验证状态
        Tickets.refundInfo memory info = ticketsManager.findowners(activityId);  // 获取所有持有者
        for (uint i = 0; i < info.players.length; i++) {  // 遍历所有玩家
            pointsManager.transfer(info.players[i], info.counts[i] * round.amountperticket);  // 退款
        }
        round.status = ActivityStatus.Finished;  // 设置状态为已完成
        ticketsManager.ActivityEnded(activityId);
    }

    function validchoice(string memory choice, string[] memory choices) internal pure returns (bool) {  // 验证选项是否有效
        for (uint i = 0; i < choices.length; i++) {
            if (keccak256(abi.encodePacked(choices[i])) == keccak256(abi.encodePacked(choice))) {  // 字符串比较
                return true;
            }
        }
        return false;
    }

    // 获取玩家在某个活动中是否已参与
    function hasPlayerJoined(uint256 activityId, address player) public view returns (bool) {
        return GameRoundsPool[activityId].hasJoined[player];
    }
    // 获取某个活动的参与人数
    function getActivityPlayerCount(uint256 activityId) public view returns (uint256) {
        return GameRoundsPool[activityId].players.length;
    }

    // 获取玩家持有的所有彩票（通过 Tickets 合约）
    function getPlayerTickets(address player) public view returns (uint256[] memory) {
        // 这里需要遍历所有活动，获取玩家的彩票
        uint256 totalTickets = 0;
        for (uint256 i = 0; i < gameRoundCount; i++) {  // 遍历所有活动
            if (GameRoundsPool[i].hasJoined[player]) {  // 如果玩家参与
                totalTickets++;  // 计数增加
            }
        }
        
        uint256[] memory activityIds = new uint256[](totalTickets);  // 创建数组
        uint256 index = 0;
        for (uint256 i = 0; i < gameRoundCount; i++) {
            if (GameRoundsPool[i].hasJoined[player]) {
                activityIds[index] = i;  // 记录活动ID
                index++;
            }
        }
        
        return activityIds;
    }
    // 更新活动状态（根据时间自动更新）
    function updateActivityStatus(uint256 activityId) public {
        if (activityId >= gameRoundCount) {  // 验证活动ID有效
            revert("Invalid activity ID");
        }
        GameRound storage round = GameRoundsPool[activityId];
        if (block.timestamp < round.startTime) {  // 根据当前时间更新状态
            round.status = ActivityStatus.NotStarted;
        } else if (block.timestamp >= round.startTime && block.timestamp <= round.endTime) {
            round.status = ActivityStatus.Ongoing;
        } else {
            round.status = ActivityStatus.Ended;
        }
    }

    // 批量更新所有活动状态
    function updateAllActivityStatuses() public {
        for (uint256 i = 0; i < gameRoundCount; i++) {  // 遍历所有活动
            updateActivityStatus(i);  // 逐个更新状态
        }
    }
    function buyticket(uint256 tokenId) public {  // 购买其他用户的彩票
        uint256 price=ticketsManager.getTicketPrice(tokenId);  // 获取售价
        pointsManager.transferFrom(msg.sender, ticketsManager.ownerOf(tokenId), price);  // 支付积分
        ticketsManager.tickettransfer( msg.sender,tokenId);  // 转移彩票所有权

    }
    // 新增：获取用户完整信息（包含彩票和积分）
    function getUserCompleteInfo(address user) public view returns (
        uint256 pointsBalance,
        Tickets.UserCompleteInfo memory ticketsInfo
    ) {
        // 获取积分余额
        pointsBalance = pointsManager.balanceOf(user);  // 查询积分余额
        
        // 获取彩票信息
        ticketsInfo = ticketsManager.getUserTickets(user);  // 查询彩票信息
        
        return (pointsBalance, ticketsInfo);  // 返回完整信息
    }
    
    // 新增：获取用户在特定活动的彩票
    function getUserActivityTickets(address user, uint256 activityId) 
        public view returns (Tickets.UserTicketDetails[] memory) {
        return ticketsManager.getUserTicketsByActivity(user, activityId);  // 返回特定活动的彩票
    }

}
