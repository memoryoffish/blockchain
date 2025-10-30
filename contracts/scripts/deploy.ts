import { ethers } from "hardhat";

async function main() {
  const EasyBet = await ethers.getContractFactory("EasyBet");
  const easyBet = await EasyBet.deploy();
  await easyBet.deployed();

  console.log(`EasyBet deployed to ${easyBet.address}`);
  const points=await easyBet.pointsManager();
  console.log(`PointsManager deployed to ${points}`);
  const ticket=await easyBet.ticketsManager();
  console.log(`TicketsManager deployed to ${ticket}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});