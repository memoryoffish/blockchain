import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("EasyBet System Test", function () {
  // 部署合约的 fixture
  async function deployFixture() {
    const [owner, player1, player2, player3] = await ethers.getSigners();

    const EasyBet = await ethers.getContractFactory("EasyBet");
    const easyBet = await EasyBet.deploy();

    // 获取 Points 和 Tickets 合约地址
    const pointsAddress = await easyBet.pointsManager();
    const ticketsAddress = await easyBet.ticketsManager();

    const Points = await ethers.getContractFactory("Points");
    const pointsManager = Points.attach(pointsAddress);

    const Tickets = await ethers.getContractFactory("Tickets");
    const ticketsManager = Tickets.attach(ticketsAddress);

    return { easyBet, pointsManager, ticketsManager, owner, player1, player2, player3 };
  }

  describe("Activity Status Update", function () {
    it("Should update activity status correctly", async function () {
      const { easyBet, owner } = await loadFixture(deployFixture);
  
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + 86400; // 1 day later
  
      // 创建活动
      await easyBet.connect(owner).createGameRound(
        "Test Activity",
        "Description",
        ["Option A", "Option B"],
        startTime,
        endTime,
        100,
        0
      );
      // 检查初始状态
      let rounds = await easyBet.getAllGameRounds();
      await time.increaseTo(startTime +100);
      expect(rounds[0].status).to.equal(1); // 未开始
  
      // 模拟时间到活动开始
      await time.increaseTo(startTime +500);
      await easyBet.updateActivityStatus(0);
  
      rounds = await easyBet.getAllGameRounds();
      expect(rounds[0].status).to.equal(1);
      // 模拟时间到活动结束
      await time.increaseTo(endTime + 200);
      await easyBet.updateAllActivityStatuses();
      rounds = await easyBet.getAllGameRounds();
      expect(rounds[0].status).to.equal(2); // 已结束
    });
  
    it("Should not update status for invalid activity ID", async function () {
      const { easyBet } = await loadFixture(deployFixture);
  
      await expect(easyBet.updateActivityStatus(999)).to.be.revertedWith("Invalid activity ID");
    });
  });
  describe("Points Contract", function () {

    it("Should not allow double airdrop claim", async function () {
      const { pointsManager, player1 } = await loadFixture(deployFixture);
      
      await pointsManager.connect(player1).airdrop();
      await expect(
        pointsManager.connect(player1).airdrop()
      ).to.be.revertedWith("Airdrop already claimed");
    });


    it("Should not allow non-admin to mint", async function () {
      const { pointsManager, player1, player2 } = await loadFixture(deployFixture);
      
      await expect(
        pointsManager.connect(player1).mint(player2.address, 5000)
      ).to.be.revertedWith("Only admin can call this function");
    });
  });

  describe("Game Round Creation", function () {
    it("Should create a game round", async function () {
      const { easyBet, owner } = await loadFixture(deployFixture);
      
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + 86400; // 1 day later
      
      await easyBet.connect(owner).createGameRound(
        "Test Activity",
        "This is a test activity",
        ["Option A", "Option B"],
        startTime,
        endTime,
        100,
        0
      );

      const rounds = await easyBet.getAllGameRounds();
      expect(rounds.length).to.equal(1);
      expect(rounds[0].name).to.equal("Test Activity");
    });

    it("Should not allow non-manager to create game round", async function () {
      const { easyBet, player1 } = await loadFixture(deployFixture);
      
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + 86400;
      
      await expect(
        easyBet.connect(player1).createGameRound(
          "Test Activity",
          "Description",
          ["A", "B"],
          startTime,
          endTime,
          100,
          0
        )
      ).to.be.reverted;
    });
  });

  describe("Playing Game", function () {
    it("Should allow player to buy tickets", async function () {
      const { easyBet, pointsManager, ticketsManager, owner, player1 } = await loadFixture(deployFixture);
      
      // Player claims airdrop
      await pointsManager.connect(player1).airdrop();
      
      // Create game round
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + 86400;
      
      await easyBet.connect(owner).createGameRound(
        "Test Activity",
        "Description",
        ["A", "B"],
        startTime,
        endTime,
        100,
        0
      );
      const easyBetAddress = await easyBet.getAddress();
      // Approve Points transfer
      await pointsManager.connect(player1).approve(await easyBetAddress, 200);
      
      // Play game
      await easyBet.connect(player1).play("A", 0, 2);
      
      // Check ticket count
      const ticketCount = await ticketsManager.balanceOf(player1.address);
      expect(ticketCount).to.equal(2);
      
      // Check points deducted
      const balance = await pointsManager.balanceOf(player1.address);
      expect(balance).to.equal(10000 - 200);
    });

    it("Should not allow play with insufficient points", async function () {
      const { easyBet, pointsManager, owner, player1 } = await loadFixture(deployFixture);
      
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + 86400;
      
      await easyBet.connect(owner).createGameRound(
        "Test Activity",
        "Description",
        ["A", "B"],
        startTime,
        endTime,
        100,
        0
      );

      await pointsManager.connect(player1).approve(await easyBet.manager(), 100);
      
      await expect(
        easyBet.connect(player1).play("A", 0, 1)
      ).to.be.revertedWith("Not enough points");
    });

    it("Should not allow invalid choice", async function () {
      const { easyBet, pointsManager, owner, player1 } = await loadFixture(deployFixture);
      
      await pointsManager.connect(player1).airdrop();
      
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + 86400;
      
      await easyBet.connect(owner).createGameRound(
        "Test Activity",
        "Description",
        ["A", "B"],
        startTime,
        endTime,
        100,
        0
      );

      await pointsManager.connect(player1).approve(await easyBet.manager(), 100);
      
      await expect(
        easyBet.connect(player1).play("C", 0, 1)
      ).to.be.revertedWith("Invalid choice");
    });
  });


  describe("Buy Tickets from Sale", function () {
    it("Should allow a player to buy a ticket from another player", async function () {
      const { easyBet, ticketsManager,owner, pointsManager, player1, player2 } = await loadFixture(deployFixture);

      // Player1 claims airdrop and buys tickets
      await pointsManager.connect(player1).airdrop();
      await pointsManager.connect(player2).airdrop();
      
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + 86400;
      
      await easyBet.connect(owner).createGameRound(
        "Test Activity",
        "Description",
        ["A", "B"],
        startTime,
        endTime,
        100,
        0
      );

      // Players play
      await pointsManager.connect(player1).approve(await easyBet.getAddress(), 200);
      await pointsManager.connect(player2).approve(await easyBet.getAddress(), 100);
      
      await easyBet.connect(player1).play("A", 0, 2);
      await easyBet.connect(player2).play("B", 0, 1);
      await ticketsManager.connect(player1).sellTicket(0, 200);
      await pointsManager.connect(player2).approve(await easyBet.getAddress(), 200);
      await easyBet.connect(player2).buyticket(0);
      // Check Player1 received points
      const player1Balance = await pointsManager.balanceOf(player1.address);
      expect(player1Balance).to.equal(10000);

      // Check Player2 points deducted
      const player2Balance = await pointsManager.balanceOf(player2.address);
      expect(player2Balance).to.equal(10000-300);
    });

  });

  describe("Draw and Refund", function () {
    it("Should draw winners and distribute rewards", async function () {
      const { easyBet, pointsManager, owner, player1, player2 } = await loadFixture(deployFixture);
      
      // Setup
      await pointsManager.connect(player1).airdrop();
      await pointsManager.connect(player2).airdrop();
      
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + 86400;
      
      await easyBet.connect(owner).createGameRound(
        "Test Activity",
        "Description",
        ["A", "B"],
        startTime,
        endTime,
        100,
        0
      );

      // Players play
      await pointsManager.connect(player1).approve(await easyBet.getAddress(), 200);
      await pointsManager.connect(player2).approve(await easyBet.getAddress(), 100);
      
      await easyBet.connect(player1).play("A", 0, 2);
      await easyBet.connect(player2).play("B", 0, 1);
      // Draw
      await easyBet.connect(owner).draw("A", 0);
      
      // Check player1 won
      const player1Balance = await pointsManager.balanceOf(player1.address);
      expect(player1Balance).to.be.greaterThan(10000 - 200);
    });

    it("Should refund all players", async function () {
      const { easyBet, pointsManager, owner, player1, player2 } = await loadFixture(deployFixture);
      
      // Setup
      await pointsManager.connect(player1).airdrop();
      await pointsManager.connect(player2).airdrop();
      
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + 86400;
      
      await easyBet.connect(owner).createGameRound(
        "Test Activity",
        "Description",
        ["A", "B"],
        startTime,
        endTime,
        100,
        0
      );

      // Players play
      await pointsManager.connect(player1).approve(await easyBet.getAddress(), 200);
      await pointsManager.connect(player2).approve(await easyBet.getAddress(), 100);
      
      await easyBet.connect(player1).play("A", 0, 2);
      await easyBet.connect(player2).play("B", 0, 1);
      
      // Refund
      await easyBet.connect(owner).refund(0);
      
      // Check balances
      const player1Balance = await pointsManager.balanceOf(player1.address);
      const player2Balance = await pointsManager.balanceOf(player2.address);
      
      expect(player1Balance).to.equal(10000);
      expect(player2Balance).to.equal(10000);
    });
  });

});