import { useEffect, useState } from 'react';
import { Table, Button, message,Input, InputNumber, Modal, Checkbox, Space, Tabs } from 'antd';
import { useAccount } from '../contexts/AccountContext';
import { web3, easyBetContract, pointsManagerContract, ticketsManagerContract } from '../utils/contracts';
import { ColumnsType } from 'antd/es/table';
import type { FilterDropdownProps } from 'antd/es/table/interface';
const { TabPane } = Tabs;

interface Ticket {
    tokenId: number;
    activityId: string;
    choice: string;
    timestamp: string;
    status: 'active' | 'ended'|'selling';
    price?: number;
    selected?: boolean;
}

interface MarketTicket {
    tokenId: number;
    activityId: string;
    choice: string;
    price: string;
    seller: string;
}

const TicketTrading = () => {
    const [marketTickets, setMarketTickets] = useState<MarketTicket[]>([]);
    const [sellableTickets, setSellableTickets] = useState<Ticket[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [SelledTickets, setSelledTickets] = useState<Ticket[]>([]);
    const { account } = useAccount();
    const [selectedTickets, setSelectedTickets] = useState<Set<number>>(new Set());
    const [ticketPrices, setTicketPrices] = useState<Map<number, number>>(new Map());
    const [isCancelModalVisible, setIsCancelModalVisible] = useState(false);
    const [selectedSelledTickets, setSelectedSelledTickets] = useState<Set<number>>(new Set());
    useEffect(() => {
        if (account) {
            fetchMarketTickets();
            fetchMyTickets();
        }
    }, [account]);

    // 获取市场上的彩票
    const fetchMarketTickets = async () => {
        try {
            const allTickets = await ticketsManagerContract.methods.getallticketsonsaleReturninfo().call();
            const formattedTickets = allTickets.map((ticket: any) => ({
                tokenId: ticket.tokenId,
                activityId: ticket.activityId,
                choice: ticket.choice,
                price: ticket.value,
                seller: ticket.seller,
            }));
            setMarketTickets(formattedTickets);
        } catch (error) {
            console.error('Failed to fetch tickets for sale:', error);
            message.error('获取在售彩票失败');
        }
    };

    // 获取我的彩票
    const fetchMyTickets = async () => {
        try {
            const userTickets = await easyBetContract.methods.getUserCompleteInfo(account).call();
            const formattedTickets = userTickets.ticketsInfo.ticketDetails.map((ticket: any) => ({
                tokenId: Number(ticket.tokenId),
                activityId: ticket.activityId,
                choice: ticket.choice,
                timestamp: new Date(Number(ticket.timestamp) * 1000).toLocaleString(),
                status: ticket.status==1?'active':ticket.status==0?'ended':'selling',
                price: userTickets.ticketsInfo.ticketSaleDetails.find((saleInfo: any) => saleInfo.tokenId === ticket.tokenId)?.value || 0,
                selected: false,
            }));
            setSellableTickets(formattedTickets.filter((t: Ticket) => t.status === 'active'));
            setSelledTickets(formattedTickets.filter((t: Ticket) => t.status === 'selling'));
        } catch (error) {
            console.error('Failed to fetch tickets:', error);
            message.error('获取彩票信息失败');
        }
    };

    // 购买彩票
    const handleBuyTicket = async (ticket: MarketTicket) => {
        try {
            await pointsManagerContract.methods
                .approve(easyBetContract.options.address, ticket.price)
                .send({ from: account });

            await easyBetContract.methods.buyticket(ticket.tokenId).send({
                from: account
            });
            
            message.success('购买成功');
            fetchMarketTickets();
            fetchMyTickets();
        } catch (error) {
            console.error('Failed to buy ticket:', error);
            message.error('购买失败');
        }
    };
    const handleBatchCancelTickets = async () => {
        try {
            if (selectedSelledTickets.size === 0) {
                message.warning('请至少选择一张彩票');
                return;
            }
            const ticketArray = Array.from(selectedSelledTickets);
            
            message.info('正在批量撤回彩票...');
            // 逐个撤回彩票
            for (const tokenId of ticketArray) {
                await ticketsManagerContract.methods.delistticketsaleinfo(tokenId).send({
                    from: account
                });
            }
            
            message.success(`成功撤回 ${selectedSelledTickets.size} 张彩票`);
            setIsCancelModalVisible(false);
            setSelectedSelledTickets(new Set());
            fetchMarketTickets();
            fetchMyTickets();
        } catch (error) {
            console.error('Failed to cancel tickets:', error);
            message.error('撤回失败');
        }
    }
    // 批量上架彩票
    const handleBatchSellTickets = async () => {
        try {
            if (selectedTickets.size === 0) {
                message.warning('请至少选择一张彩票');
                return;
            }
            const ticketArray = Array.from(selectedTickets);
            // 检查所有选中的彩票是否都设置了价格
            for (const tokenId of ticketArray) {
                const price = ticketPrices.get(tokenId);
                if (!price || price <= 0) {
                    message.warning(`请为彩票 #${tokenId} 设置有效价格`);
                    return;
                }
            }

            message.info('正在批量上架彩票...');

            // 逐个上架彩票
            for (const tokenId of ticketArray) {
                const price = ticketPrices.get(tokenId);
                await ticketsManagerContract.methods.sellTicket(tokenId, price).send({
                    from: account
                });
            }

            message.success(`成功上架 ${selectedTickets.size} 张彩票`);
            setIsModalVisible(false);
            setSelectedTickets(new Set());
            setTicketPrices(new Map());
            fetchMarketTickets();
            fetchMyTickets();
        } catch (error) {
            console.error('Failed to sell tickets:', error);
            message.error('上架失败');
        }
    };

    // 切换彩票选中状态
    const handleSelectTicket = (tokenId: number, checked: boolean) => {
        const newSelected = new Set(selectedTickets);
        if (checked) {
            newSelected.add(tokenId);
        } else {
            newSelected.delete(tokenId);
        }
        setSelectedTickets(newSelected);
    };
    const handleSelectListedTicket = (tokenId: number, checked: boolean) => {
        const newSelected = new Set(selectedSelledTickets);
        if (checked) {
            newSelected.add(tokenId);
        } else {
            newSelected.delete(tokenId);
        }
        setSelectedSelledTickets(newSelected);
    }
    // 设置彩票价格
    const handleSetPrice = (tokenId: number, price: number) => {
        const newPrices = new Map(ticketPrices);
        newPrices.set(tokenId, price);
        setTicketPrices(newPrices);
    };

    // 全选/取消全选
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allTokenIds = new Set(sellableTickets.map(t => t.tokenId));
            setSelectedTickets(allTokenIds);
        } else {
            setSelectedTickets(new Set());
        }
    };
    const handleSelectAllListed = (checked: boolean) => {
        if (checked) {
            const allTokenIds = new Set(SelledTickets.map(t => t.tokenId));
            setSelectedSelledTickets(allTokenIds);
        } else {
            setSelectedSelledTickets(new Set());
        }
    };

    // 市场彩票表格列
    const marketColumns:ColumnsType<MarketTicket> = [
        {
            title: '彩票ID',
            dataIndex: 'tokenId',
            key: 'tokenId',
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
            filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
                <div style={{ padding: 8 }}>
                    <Input
                        placeholder="搜索选择"
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
            title: '价格',
            dataIndex: 'price',
            key: 'price',
            sorter: (a: MarketTicket, b: MarketTicket) => Number(a.price) - Number(b.price),
            render: (price: string) => `${price} 代币`,
        },
        {
            title: '卖家',
            dataIndex: 'seller',
            key: 'seller',
            render: (seller: string) => `${seller.slice(0, 6)}...${seller.slice(-4)}`,
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: MarketTicket) => (
                <Button type="primary" onClick={() => handleBuyTicket(record)}>
                    购买
                </Button>
            ),
        },
    ];

    // 我的彩票表格列
    const myTicketsColumns = [
        {
            title: <Checkbox 
                checked={selectedTickets.size === sellableTickets.length && sellableTickets.length > 0}
                indeterminate={selectedTickets.size > 0 && selectedTickets.size < sellableTickets.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
            >
                选择
            </Checkbox>,
            key: 'select',
            width: 80,
            render: (_: any, record: Ticket) => (
                <Checkbox
                    checked={selectedTickets.has(record.tokenId)}
                    onChange={(e) => handleSelectTicket(record.tokenId, e.target.checked)}
                />
            ),
        },
        {
            title: '彩票ID',
            dataIndex: 'tokenId',
            key: 'tokenId',
        },
        {
            title: '活动ID',
            dataIndex: 'activityId',
            key: 'activityId',
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
        },
                {
            title: '设置价格',
            key: 'price',
            render: (_: any, record: Ticket) => (
                <InputNumber
                    min={1}
                    step={1}
                    placeholder="输入价格"
                    value={ticketPrices.get(record.tokenId) || 0}
                    onChange={(value) => handleSetPrice(record.tokenId, value || 0)}
                    addonAfter="代币"
                    style={{ width: '150px' }}
                    disabled={!selectedTickets.has(record.tokenId)}
                />
            ),
        },
    ];

    // 已上架彩票表格列
    const listedTicketsColumns = [
        {
            title: <Checkbox 
                checked={selectedSelledTickets.size === SelledTickets.length && SelledTickets.length > 0}
                indeterminate={selectedSelledTickets.size > 0 && selectedSelledTickets.size < SelledTickets.length}
                onChange={(e) => handleSelectAllListed(e.target.checked)}
            >
                选择
            </Checkbox>,
            key: 'select',
            width: 80,
            render: (_: any, record: Ticket) => (
                <Checkbox
                    checked={selectedSelledTickets.has(record.tokenId)}
                    onChange={(e) => handleSelectListedTicket(record.tokenId, e.target.checked)}
                />
            ),
        },
        {
            title: '彩票ID',
            dataIndex: 'tokenId',
            key: 'tokenId',
        },
        {
            title: '活动ID',
            dataIndex: 'activityId',
            key: 'activityId',
        },
        {
            title: '选择',
            dataIndex: 'choice',
            key: 'choice',
        },
        {
            title: '售价',
            dataIndex: 'price',
            key: 'price',
            render: (price: number) => `${price} 代币`,
        },
    ];

    return (
        <div style={{ padding: '24px' }}>
            <h2>彩票交易市场</h2>
            
            <Tabs defaultActiveKey="market">
                <TabPane tab="交易市场" key="market">
                <Table 
                    dataSource={marketTickets} 
                    columns={marketColumns} 
                    rowKey="tokenId"
                    pagination={{ pageSize: 10 }}
                />
            </TabPane>

            <TabPane tab="可上架彩票" key="myTickets">
                <Space style={{ marginBottom: '16px' }}>
                    <Button 
                        type="primary" 
                        onClick={() => setIsModalVisible(true)}
                        disabled={selectedTickets.size === 0}
                    >
                        批量上架 ({selectedTickets.size})
                    </Button>
                    <Button onClick={() => fetchMyTickets()}>
                        刷新
                    </Button>
                </Space>
                <Table 
                    dataSource={sellableTickets} 
                    columns={myTicketsColumns} 
                    rowKey="tokenId"
                    pagination={{ pageSize: 10 }}
                />
            </TabPane>

                <TabPane tab={`已上架彩票 (${SelledTickets.length})`} key="selledTickets">
                    <Space style={{ marginBottom: '16px' }}>
                        <Button 
                            danger
                            onClick={() => setIsCancelModalVisible(true)}
                            disabled={selectedSelledTickets.size === 0}
                        >
                            批量撤回 ({selectedSelledTickets.size})
                        </Button>
                        <Button onClick={() => fetchMyTickets()}>
                            刷新
                        </Button>
                    </Space>
                    <Table 
                        dataSource={SelledTickets} 
                        columns={listedTicketsColumns} 
                        rowKey="tokenId"
                        pagination={{ pageSize: 10 }}
                    />
                </TabPane>
            </Tabs>

            {/* 批量上架确认模态框 */}
            <Modal
                title={`批量上架彩票 (${selectedTickets.size} 张)`}
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setIsModalVisible(false)}>
                        取消
                    </Button>,
                    <Button key="submit" type="primary" onClick={handleBatchSellTickets}>
                        确认上架
                    </Button>
                ]}
                width={600}
            >
                <div style={{ marginBottom: '16px' }}>
                    <p>已选择 {selectedTickets.size} 张彩票，请确认价格设置：</p>
                    {Array.from(selectedTickets).map(tokenId => {
                        const ticket = sellableTickets.find(t => t.tokenId === tokenId);
                        const price = ticketPrices.get(tokenId);
                        return (
                            <div key={tokenId} style={{ marginBottom: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                                <Space>
                                    <span>彩票 #{tokenId}</span>
                                    <span>活动ID: {ticket?.activityId}</span>
                                    <span>选择: {ticket?.choice}</span>
                                    <span style={{ color: price && price > 0 ? 'green' : 'red' }}>
                                        价格: {price || 0} 代币
                                    </span>
                                </Space>
                            </div>
                        );
                    })}
                </div>
            </Modal>

            {/* 批量撤回确认模态框 */}
            <Modal
                title={`批量撤回彩票 (${selectedSelledTickets.size} 张)`}
                open={isCancelModalVisible}
                onCancel={() => setIsCancelModalVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setIsCancelModalVisible(false)}>
                        取消
                    </Button>,
                    <Button key="submit" type="primary" danger onClick={handleBatchCancelTickets}>
                        确认撤回
                    </Button>
                ]}
                width={600}
            >
                <div style={{ marginBottom: '16px' }}>
                    <p>确定要撤回以下 {selectedSelledTickets.size} 张彩票吗？</p>
                    {Array.from(selectedSelledTickets).map(tokenId => {
                        const ticket = SelledTickets.find(t => t.tokenId === tokenId);
                        return (
                            <div key={tokenId} style={{ marginBottom: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                                <Space>
                                    <span>彩票 #{tokenId}</span>
                                    <span>活动ID: {ticket?.activityId}</span>
                                    <span>选择: {ticket?.choice}</span>
                                    <span>售价: {ticket?.price} 代币</span>
                                </Space>
                            </div>
                        );
                    })}
                </div>
            </Modal>
        </div>
    );
};

export default TicketTrading;