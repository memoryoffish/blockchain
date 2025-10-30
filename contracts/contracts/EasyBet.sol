// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

// Uncomment the line to use openzeppelin/ERC721,ERC20
// You can use this dependency directly because it has been installed by TA already
// import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Uncomment this line to use console.log
import "hardhat/console.sol";
import "./Tickets.sol";
import "./Points.sol";
contract EasyBet {
    address public manager; // 管理员，用来开奖和退款   
    // use a event if you want
    // to represent time you can choose block.timestamp
    Points public pointsManager;
    Tickets public ticketsManager;
    modifier onlyManager {
        require(msg.sender == manager);
        _;
    }
    enum ActivityStatus { NotStarted, Ongoing, Ended,Finished }
    // maybe you need a struct to store some activity information
    struct GameRound {
        uint256 id;
        address[]  players; // 玩家
        string name;
        string description;
        mapping(address => bool) hasJoined; // 记录玩家是否已参与
        address  winner; // 胜者
        string[] choices;
        uint256 startTime;
        uint256 endTime;
        uint256 amountperticket;
        uint256 totalAmount; // 奖池总共金额
        ActivityStatus status;
    }
    struct GameRoundBack{
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
    mapping(uint256 => GameRound) public GameRoundsPool;
    uint256 public gameRoundCount;
    
    constructor() {
        manager = msg.sender;
        pointsManager = new Points();    
        ticketsManager = new Tickets();
    }

    function getAddress() view external returns(address){
        return address(this);
    }
    function getPlayerNumber(uint256 activityId) view external returns (uint256){
        return GameRoundsPool[activityId].players.length;
    }

    function play(string memory choice, uint256 activityId,uint256 number) public {
        GameRound storage round = GameRoundsPool[activityId];
        require(round.status==ActivityStatus.Ongoing, "Activity has not started yet");
        require(validchoice(choice, round.choices), "Invalid choice");
        require(pointsManager.balanceOf(msg.sender) >= round.amountperticket, "Not enough points");
        bool ok= pointsManager.transferFrom(msg.sender, address(this), round.amountperticket*number);
        require(ok, "TransferFrom failed");  
        if (!round.hasJoined[msg.sender]) {
            round.players.push(msg.sender); // 只有未参与的玩家才添加
            round.hasJoined[msg.sender] = true; // 标记为已参与
        }
        ticketsManager.mintTicket(msg.sender, activityId, choice,number);
        round.totalAmount += round.amountperticket*number;
    }

    function createGameRound(
        string memory name,
        string memory description,
        string[] memory choices,
        uint256 startTime,
        uint256 endTime,
        uint256 amountperticket,
        uint256 totalAmount
    ) onlyManager public {
        require(startTime < endTime, "Start time must be before end time");
        require(endTime > block.timestamp, "End time must be in the future");
        // 创建一个空的 GameRound
        GameRound storage newRound = GameRoundsPool[gameRoundCount];
        newRound.id = gameRoundCount;
        newRound.name = name;
        newRound.description = description;
        newRound.choices = choices;
        newRound.startTime = startTime;
        newRound.endTime = endTime;
        newRound.amountperticket = amountperticket;
        newRound.totalAmount = totalAmount;
        if (block.timestamp >= startTime) {
            newRound.status = ActivityStatus.Ongoing;
        } else {
            newRound.status = ActivityStatus.NotStarted;
        }
        pointsManager.mint(address(this), totalAmount);
        gameRoundCount++;
    }
    function getAllGameRounds() public view returns (GameRoundBack[] memory) {
        GameRoundBack[] memory rounds = new GameRoundBack[](gameRoundCount);
        for (uint256 i = 0; i < gameRoundCount; i++) {
            GameRound storage round = GameRoundsPool[i];
            rounds[i] = GameRoundBack({
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
    function draw(string memory choice, uint256 activityId) onlyManager public {
        GameRound storage round = GameRoundsPool[activityId];
        require(round.status!=ActivityStatus.Ended, "Activity has already ended");
        Tickets.winnerInfo memory info = ticketsManager.findwiners(activityId, choice);
        if (info.totalwintickets==0){
            ticketsManager.ActivityEnded(activityId);
            round.status = ActivityStatus.Finished;
            return;
        }
        uint256 singletickterwinamount = round.totalAmount / info.totalwintickets;
        for (uint i = 0; i < info.owners.length; i++) {
            bool success = pointsManager.transfer(info.owners[i], info.counts[i] * singletickterwinamount);
            require(success, "Transfer failed");
        }
        ticketsManager.ActivityEnded(activityId);
        round.status = ActivityStatus.Finished;
    }

    function refund(uint256 activityId) onlyManager public {
        GameRound storage round = GameRoundsPool[activityId];
        require(round.status!=ActivityStatus.Ended, "Activity has already ended");
        Tickets.refundInfo memory info = ticketsManager.findowners(activityId);
        for (uint i = 0; i < info.players.length; i++) {
            pointsManager.transfer(info.players[i], info.counts[i] * round.amountperticket);
        }
        round.status = ActivityStatus.Finished;
        ticketsManager.ActivityEnded(activityId);
    }

    function validchoice(string memory choice, string[] memory choices) internal pure returns (bool) {
        for (uint i = 0; i < choices.length; i++) {
            if (keccak256(abi.encodePacked(choices[i])) == keccak256(abi.encodePacked(choice))) {
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
        for (uint256 i = 0; i < gameRoundCount; i++) {
            if (GameRoundsPool[i].hasJoined[player]) {
                totalTickets++;
            }
        }
        
        uint256[] memory activityIds = new uint256[](totalTickets);
        uint256 index = 0;
        for (uint256 i = 0; i < gameRoundCount; i++) {
            if (GameRoundsPool[i].hasJoined[player]) {
                activityIds[index] = i;
                index++;
            }
        }
        
        return activityIds;
    }
    // 更新活动状态（根据时间自动更新）
    function updateActivityStatus(uint256 activityId) public {
        if (activityId >= gameRoundCount) {
            revert("Invalid activity ID");
        }
        GameRound storage round = GameRoundsPool[activityId];
        if (block.timestamp < round.startTime) {
            round.status = ActivityStatus.NotStarted;
        } else if (block.timestamp >= round.startTime && block.timestamp <= round.endTime) {
            round.status = ActivityStatus.Ongoing;
        } else {
            round.status = ActivityStatus.Ended;
        }
    }

    // 批量更新所有活动状态
    function updateAllActivityStatuses() public {
        for (uint256 i = 0; i < gameRoundCount; i++) {
            updateActivityStatus(i);
        }
    }
    function buyticket(uint256 tokenId) public {
        uint256 price=ticketsManager.getTicketPrice(tokenId);
        pointsManager.transferFrom(msg.sender, ticketsManager.ownerOf(tokenId), price);
        ticketsManager.tickettransfer( msg.sender,tokenId);

    }
    // 新增：获取用户完整信息（包含彩票和积分）
    function getUserCompleteInfo(address user) public view returns (
        uint256 pointsBalance,
        Tickets.UserCompleteInfo memory ticketsInfo
    ) {
        // 获取积分余额
        pointsBalance = pointsManager.balanceOf(user);
        
        // 获取彩票信息
        ticketsInfo = ticketsManager.getUserTickets(user);
        
        return (pointsBalance, ticketsInfo);
    }
    
    // 新增：获取用户在特定活动的彩票
    function getUserActivityTickets(address user, uint256 activityId) 
        public view returns (Tickets.UserTicketDetails[] memory) {
        return ticketsManager.getUserTicketsByActivity(user, activityId);
    }

}