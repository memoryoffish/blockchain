import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Button, Modal, Form, Input, InputNumber, message, Statistic, Tag, Space, Tabs } from 'antd';
import { WalletOutlined, SendOutlined,  TrophyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import {useAccount} from '../contexts/AccountContext';
import{web3,easyBetContract, pointsManagerContract, ticketsManagerContract} from '../utils/contracts'
const { TabPane } = Tabs;

interface Ticket {
    tokenId: number;
    activityId: string;
    choice: string;
    timestamp: string;
    status: 'active' | 'ended'| 'selling';
}

const MyWallet: React.FC = () => {
  const [balance, setBalance] = useState(10000);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [form] = Form.useForm();
  const { account,managerAccount} = useAccount();
  // 模拟数据
  useEffect(() => {
    const fetchTickets = async () => {
        try {

            const userTickets = await easyBetContract.methods.getUserCompleteInfo(account).call();
            console.log(userTickets);
            const formattedTickets = userTickets.ticketsInfo.ticketDetails.map((ticket: any) => ({
                tokenId: ticket.tokenId,
                activityId: ticket.activityId,
                choice: ticket.choice,
                timestamp: new Date(ticket.timestamp * 1000).toLocaleString(),
                status: ticket.status==1?'active':ticket.status==0?'ended':'selling',
                price: userTickets.ticketsInfo.ticketSaleDetails.find((saleInfo: any) => saleInfo.tokenId === ticket.tokenId)?.price || 0,
            }));

            const points=userTickets.pointsBalance;
            setBalance(points);
            setTickets(formattedTickets);
        } catch (error) {
            console.error('Failed to fetch tickets:', error);
            message.error('获取彩票信息失败');
        }
    };

    fetchTickets();
  }, []);



  const getTicketStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'blue';
      case 'ended': return 'green';
      case 'selling': return 'red';
    }
  };

  const columns: ColumnsType<Ticket> = [
    {
        title: '彩票ID',
        dataIndex: 'tokenId',
        key: 'tokenId',
        sorter: (a, b) => a.tokenId - b.tokenId,
    },
    {
        title: '活动ID',
        dataIndex: 'activityId',
        key: 'activityId',
        sorter: (a, b) => a.activityId.localeCompare(b.activityId),
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
            <div style={{ padding: 8 }}>
                <Input
                    placeholder="搜索活动ID"
                    value={selectedKeys[0]}
                    onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                    onPressEnter={(e) => { e.preventDefault(); confirm(); }}
                    style={{ marginBottom: 8, display: 'block' }}
                />
                <Space>
                    <Button
                        type="primary"
                        onClick={() => confirm()}
                        size="small"
                        style={{ width: 90 }}
                    >
                        搜索
                    </Button>
                    <Button
                        onClick={() => clearFilters?.()}
                        size="small"
                        style={{ width: 90 }}
                    >
                        重置
                    </Button>
                </Space>
            </div>
        ),
        onFilter: (value, record) => record.activityId.includes(value as string),
    },
    {
        title: '选择',
        dataIndex: 'choice',
        key: 'choice',
    },
    {
        title: '购买时间',
        dataIndex: 'timestamp',
        key: 'timestamp',
        sorter: (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    },
    {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => (
            <Tag color={getTicketStatusColor(status)}>
                {status}
            </Tag>
        ),
        filters: [
            { text: '进行中', value: 'active' },
            { text: '已结束', value: 'ended' },
            { text: '出售中', value: 'selling' },
        ],
        onFilter: (value, record) => record.status === value,
    },
    {
        title:'售价',
        dataIndex:'price',
        key:'price',
        render: (price: number) => (
            price > 0 ? <span>{price} 点数</span> : <span>-</span>
        ),
    }
];

  const activeTickets = tickets.filter(t => t.status === "active");
  const endedTickets = tickets.filter(t => t.status === "ended");
//   const totalValue = tickets.reduce((sum, ticket) => sum + ticket.value, 0);

  return (
    <div>
      <h2>我的钱包</h2>
      
      {/* 余额统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="代币余额"
              value={balance}
              prefix={<WalletOutlined />}
              suffix="代币"
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="持有彩票"
              value={tickets.length}
              suffix="张"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="进行中彩票"
              value={activeTickets.length}
              suffix="张"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="结束的彩票"
              value={endedTickets.length}
              suffix="张"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
            <Card>
                <Statistic
                    title="出售中的彩票"
                    value={tickets.filter(t => t.status === "selling").length}
                    suffix="张"
                    valueStyle={{ color: '#fa8c16' }}
                />
            </Card>
        </Col>
      </Row>
      <Table dataSource={tickets} columns={columns} rowKey="tokenId" />

    </div>
  );
};

export default MyWallet;