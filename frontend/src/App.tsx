import React, { useState,useEffect } from 'react';
import logo from './logo.svg';
import './App.css';
import type { MenuProps } from 'antd';
import { Layout, Menu, theme } from 'antd';
import { useAccount } from './contexts/AccountContext';
import{web3,easyBetContract, pointsManagerContract, ticketsManagerContract} from './utils/contracts'
// 导入页面组件（需要创建这些组件）
import ActivitySquare from './components/ActivitySquare';
import MyWallet from './components/MyWallet';
import TicketTrading from './components/TicketTrading';
import { AccountProvider } from './contexts/AccountContext';
const { Header, Content, Footer, Sider } = Layout;
const GanacheTestChainId = '0x539' // Ganache默认的ChainId = 0x539 = Hex(1337)
// TODO change according to your configuration
const GanacheTestChainName = 'Ganache Test Chain'
const GanacheTestChainRpcUrl = 'http://127.0.0.1:8545'

function App() {
  const [selectedKey, setSelectedKey] = useState('1');
  const {account, managerAccount,setAccount,setManagerAccount} = useAccount();

  const handleMenuClick: MenuProps['onClick'] = e => {
    setSelectedKey(e.key);
  }
  useEffect(() => {
    // 初始化检查用户是否已经连接钱包
    // 查看window对象里是否存在ethereum（metamask安装后注入的）对象
    const initCheckAccounts = async () => {
        // @ts-ignore
        const {ethereum} = window;
        if (Boolean(ethereum && ethereum.isMetaMask)) {
            // 尝试获取连接的用户账户
            try{
            const accounts = await web3.eth.getAccounts()
            const manager = await easyBetContract.methods.manager().call();
            setManagerAccount(manager);
            if(accounts && accounts.length) {
                setAccount(accounts[0])
            }
            }
            catch(err){
              console.error("Error fetching accounts or manager:", err);
            }
        }
    }

    initCheckAccounts()
}, [])

  const getContentComponent = () => {
    switch(selectedKey) {
      case '1':
        return <ActivitySquare />;
      case '2':
        return <MyWallet />;
      case '3':
        return <TicketTrading />;
      default:
        return <ActivitySquare />;
    }
  }

  return (
      <Layout style={{ minHeight: '100vh' }}>
        <Sider width={200} style={{ background: '#001529' }}>
          <div style={{ 
            height: 32, 
            margin: 16, 
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold'
          }}>
            彩票系统
          </div>
          <Menu
            theme="dark"
            selectedKeys={[selectedKey]}
            mode="inline"
            items={[
              {
                key: '1',
                label: '活动广场',
              },
              {
                key: '2',
                label: '我的钱包',
              },
              {
                key: '3',
                label: '交易彩票通道',
              },
            ]}
            onClick={handleMenuClick}
          />
        </Sider>
        <Layout>
          <Header style={{ 
            padding: 0, 
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0,21,41,.08)'
          }}>
            <div style={{
              padding: '0 24px',
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#001529'
            }}>
              <span>区块链彩票平台</span>
              <span style={{float:'right'}}>管理员账户：{managerAccount}当前用户：{account === '' ? '无用户连接' : account}</span>
            </div>
          </Header>
          <Content style={{ 
            margin: '24px 16px',
            padding: 24,
            background: '#fff',
            borderRadius: 6
          }}>
            {getContentComponent()}
          </Content>
          <Footer style={{ textAlign: 'center' }}>
            Blockchain Lottery Platform ©2025
          </Footer>
        </Layout>
      </Layout>
  );
}

export default App;
