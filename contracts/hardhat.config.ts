import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    ganache: {
      // rpc url, change it according to your ganache configuration
      url: 'http://localhost:8545',
      // the private key of signers, change it according to your ganache user
      accounts: [
        '0xdde9e9608d780914e624a2d0049f246ca5073276a47ded7ec6b4cfa70db57817',
        '0x56b84dd606b812106954ed886257d7678deb3dfd8e802a49437e35a27a4e68df'
      ] 
    },
  },
};

export default config;
