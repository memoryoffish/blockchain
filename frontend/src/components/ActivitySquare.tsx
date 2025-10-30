import React, { useState, useEffect } from 'react';
import { Button, Table, Modal, Form, Input, Select, DatePicker, InputNumber, message, Space } from 'antd';
import { PlusOutlined, PlayCircleOutlined, TrophyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import {useAccount} from '../contexts/AccountContext';
import{easyBetContract, pointsManagerContract} from '../utils/contracts'
const { TextArea } = Input;
const { Option } = Select;

interface Activity {
  id: number;
  name: string;
  description: string;
  choices: string[];
  startTime: string;
  endTime: string;
  status: string; 
  totalAmount: number;
  amountperticket: number;
  isExpired: boolean;
}

const ActivitySquare: React.FC = () => {
  const [activities, setActivities] = useState([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [drawModalVisible, setDrawModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [betModalVisible, setBetModalVisible] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const { account,managerAccount} = useAccount();
  const [form] = Form.useForm();
  const [betForm] = Form.useForm();
  const getActivities = async () => {
    await easyBetContract.methods.updateAllActivityStatuses();
    const activitieds=await easyBetContract.methods.getAllGameRounds().call();
    const currentTime = Math.floor(Date.now() / 1000); // 当前时间戳（秒）
    const formattedRounds = activitieds.map((round: any) => {
      const endTime = parseInt(round.endTime);
      const isExpired = endTime < currentTime;
      
      return {
        id: round.id,
        name: round.name,
        startTime: new Date(round.startTime * 1000).toLocaleString(),
        endTime: new Date(round.endTime * 1000).toLocaleString(),
        description: round.description,
        totalAmount: round.totalAmount,
        amountperticket: round.amountperticket,
        status:(()=>{switch(round.status) {
          case '0':
            return '未开始';
          case '1':
            return isExpired ? '已结束' : '进行中';
          case '2':
            return '已结束';
          case '3':
            return '已完成';
          default:
            return '未知状态';
        }
      })(),
        choices: round.choices,
        isExpired: isExpired,
      };
    });
    setActivities(formattedRounds);
    };
  setInterval(async () => {
    getActivities();
  }, 60000); // 每分钟更新一次活动状态
  // 模拟数据
  useEffect(() => {
    getActivities();
  }, [createModalVisible,betModalVisible]);

  const handleCreateActivity = async (values: any) => {
    await easyBetContract.methods.updateAllActivityStatuses();
    if (account.toLowerCase() !== managerAccount.toLowerCase() && account!=='') {
      message.error('只有管理员才能创建活动');
      return;
    }
    try {
      // 这里应该调用智能合约的创建活动函数
      console.log(        values.startTime.unix(),
      values.endTime.unix(),)
      await easyBetContract.methods.createGameRound(
        values.name,
        values.description,
        values.choices,
        values.startTime.unix(),
        values.endTime.unix(),
        values.amountperticket,
        values.totalAmount
      ).send({ from: account });
      setCreateModalVisible(false);

    } catch (error) {
      message.error('活动创建失败');
      console.error(error);
    }
  };
  const handleActivityEnd = async (values:any) => {
    await easyBetContract.methods.updateAllActivityStatuses();
    if(account.toLowerCase() !== managerAccount.toLowerCase() && account!=='') {
      message.error('只有管理员才能结束活动');
      return;
    }
    try {
      console.log(values);
      await easyBetContract.methods.draw(
        values.choice,
        selectedActivity?.id
      ).send({ from: account });
      message.success('活动已结束');
      setDrawModalVisible(false);
    } catch (error) {
      message.error('结束活动失败');
      console.error(error);
    }
  }
  const handleActivityRefund = async (values:any) =>
  {
    await easyBetContract.methods.updateAllActivityStatuses();
    if(account.toLowerCase() !== managerAccount.toLowerCase() && account!=='') {
      message.error('只有管理员才能退款');
      return;
    }
    try {
      await easyBetContract.methods.refund(
        selectedActivity?.id
      ).send({ from: account });
      message.success('退款成功');
      setRefundModalVisible(false);
    } catch (error) {
      message.error('退款失败');
      console.error(error);
    }
  };
  const handlePlaceBet = async (values: any) => {
    try {
      // 检查活动是否已过期
      if (selectedActivity?.isExpired) {
        message.error('该活动已过期，无法投注');
        return;
      }
      
      await easyBetContract.methods.updateAllActivityStatuses();
      // 这里应该调用智能合约的投注函数
      await pointsManagerContract.methods.approve(easyBetContract.options.address, selectedActivity==null?0:values.amounttickets*selectedActivity?.amountperticket).send({ from: account });
      await easyBetContract.methods.play(
        values.choice,
        selectedActivity?.id,
        values.amounttickets
      ).send({ from: account });
      setBetModalVisible(false);
      message.success('投注成功');
    } catch (error) {
      message.error('投注失败');
      console.error(error);
    }
  };


  const columns: ColumnsType = [
    {
      title: '活动ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: '活动名称',
      dataIndex: 'name',
      key: 'name',
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
            <div style={{ padding: 8 }}>
                <Input
                    placeholder="搜索活动名称"
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
        onFilter: (value, record) => record.name.includes(value as string),
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
    },
    {
      title: '结束时间',
      dataIndex: 'endTime',
      key: 'endTime',
    },
    {
      title: '奖池总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
    },
// ...existing code...

{
  title: '操作',
  key: 'action',
  render: (_: any, record) => (
    <Space>
      <Button
        type="primary"
        icon={<PlayCircleOutlined />}
        disabled={record.isExpired || record.status !== '进行中'}
        onClick={() => {
          if (record.isExpired) {
            message.warning('该活动已结束，无法投注');
            return;
          }
          setSelectedActivity(record as Activity);
          setBetModalVisible(true);
        }}
      >
        详情
      </Button>
      {record.status === '进行中' && account.toLowerCase() === managerAccount.toLowerCase() && (
        <Button
          type="primary"
          icon={<TrophyOutlined />}
          style={{ marginLeft: 8 ,color:'red'}}
          onClick={() => {
            setSelectedActivity(record as Activity);
            setDrawModalVisible(true);
          }}
        >
          开奖
        </Button>
      )}
      {record.status === '进行中' && account.toLowerCase() === managerAccount.toLowerCase() && (
        <Button
          type="primary"
          danger
          style={{ marginLeft: 8 }}
          onClick={() => {
            setSelectedActivity(record as Activity);
            setRefundModalVisible(true);
          }}
        >
          退款活动
        </Button>
      )}
      {record.status === '已结束' && account.toLowerCase() === managerAccount.toLowerCase() && (
        <Button
        type="primary"
        icon={<TrophyOutlined />}
        style={{ marginLeft: 8 }}
        onClick={() => {
          setSelectedActivity(record as Activity);
          setDrawModalVisible(true);
        }}
      >
        开奖
      </Button>
      
      )
      }
      {record.status === '已结束' && account.toLowerCase() === managerAccount.toLowerCase() && (
        <Button
          type="primary"
          danger
          style={{ marginLeft: 8 }}
          onClick={() => {
            setSelectedActivity(record as Activity);
            setRefundModalVisible(true);
          }}
        >
          退款活动
        </Button>
      )}
    </Space>
  )
}

// ...existing code...
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>活动广场</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            try{
              pointsManagerContract.methods.airdrop().send({ from: account })}
            catch(error:any){ alert(error.message);}
          }
        
        }
        >
          领取空投
        </Button>
        {
        (account.toLowerCase() === managerAccount.toLowerCase() || account==='') && (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
        >
          创建活动
        </Button>
        )
      }
      </div>

      <Table
        columns={columns}
        dataSource={activities}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      {/* 创建活动模态框 */}
      <Modal
        title="创建新活动"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateActivity}
        >
          <Form.Item
            name="name"
            label="活动名称"
            rules={[{ required: true, message: '请输入活动名称' }]}
          >
            <Input placeholder="输入活动名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="活动描述"
            rules={[{ required: true, message: '请输入活动描述' }]}
          >
            <TextArea rows={3} placeholder="描述活动内容" />
          </Form.Item>

          <Form.Item
            name="choices"
            label="投注选项"
            rules={[{ required: true, message: '请输入投注选项' }]}
          >
            <Select
              mode="tags"
              placeholder="输入选项，按回车添加"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="startTime"
            label="开始时间"
            rules={[{ required: true, message: '请选择开始时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="endTime"
            label="结束时间"
            rules={[{ required: true, message: '请选择结束时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="totalAmount"
            label="初始奖池金额"
            rules={[{ required: true, message: '请输入初始奖池金额' }]}
          >
            <InputNumber
              min={0}
              placeholder="输入初始奖池金额"
              style={{ width: '100%' }}
              addonAfter="代币"
            />
          </Form.Item>
          <Form.Item
            name="amountperticket"
            label="每注金额"
            rules={[{ required: true, message: '请输入每注金额' }]}
          >
            <InputNumber
              min={1}
              placeholder="输入每注金额"
              style={{ width: '100%' }}
              addonAfter="代币"
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建活动
              </Button>
              <Button onClick={() => setCreateModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 投注模态框 */}
      <Modal
        title={`投注 - ${selectedActivity?.name}`}
        open={betModalVisible}
        onCancel={() => setBetModalVisible(false)}
        footer={null}
      >
        {selectedActivity?.isExpired && (
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 6 }}>
            <span style={{ color: '#ff4d4f' }}>⚠️ 该活动已过期，无法投注</span>
          </div>
        )}
        <Form
          form={betForm}
          layout="vertical"
          onFinish={handlePlaceBet}
        >
          <Form.Item name='id' label="活动ID">
            {selectedActivity?.id}
          </Form.Item>
          <Form.Item name="description" label="活动描述">
            {selectedActivity?.description}
          </Form.Item>
          <Form.Item name="totalamount" label="当前奖池金额">
            {selectedActivity?.totalAmount} 代币
          </Form.Item>
          <Form.Item name="startTime" label="开始时间">
            {selectedActivity?.startTime}
          </Form.Item>
          <Form.Item name="endTime" label="结束时间">
            {selectedActivity?.endTime}
          </Form.Item>
          <Form.Item
            name="choice"
            label="选择投注项"
            rules={[{ required: true, message: '请选择投注项' }]}
          >
            <Select placeholder="选择你的投注项">
              {selectedActivity?.choices.map((choice, index) => (
                <Option key={index} value={choice}>{choice}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="amountperticket" label="每注金额">
            {selectedActivity?.amountperticket} 代币
          </Form.Item>
          <Form.Item
            name="amounttickets"
            label="购买票数"
            rules={[{ required: true, message: '请输入购买票数' }]}
          >
            <InputNumber
              min={1}
              placeholder="输入购买票数"
              style={{ width: '100%' }}
              addonAfter="张"
            />
          </Form.Item>
                <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) => 
          prevValues.amounttickets !== currentValues.amounttickets
        }
      >
        {({ getFieldValue }) => (
          <Form.Item label="预计花费">
            {(getFieldValue('amounttickets') || 0) * (selectedActivity?.amountperticket || 0)} 代币
          </Form.Item>
        )}
      </Form.Item>
          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                disabled={selectedActivity?.isExpired}
              >
                确认投注
              </Button>
              <Button onClick={() => setBetModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="结束活动"
        open={drawModalVisible}
        onCancel={() => setDrawModalVisible(false)}
        footer={null}
      >
        <Form
          form={betForm}
          layout="vertical"
          onFinish={handleActivityEnd}
        >
          <Form.Item name='id' label="活动ID">
            {selectedActivity?.id}
          </Form.Item>
          <Form.Item name="description" label="活动描述">
            {selectedActivity?.description}
          </Form.Item>
          <Form.Item name="totalamount" label="当前奖池金额">
            {selectedActivity?.totalAmount} 代币
          </Form.Item>
          <Form.Item name="startTime" label="开始时间">
            {selectedActivity?.startTime}
          </Form.Item>
          <Form.Item name="endTime" label="结束时间">
            {selectedActivity?.endTime}
          </Form.Item>
          <Form.Item
            name="choice"
            label="选择中奖项"
            rules={[{ required: true, message: '请选择投注项' }]}
          >
            <Select placeholder="选择你的中奖项">
              {selectedActivity?.choices.map((choice, index) => (
                <Option key={index} value={choice}>{choice}</Option>
              ))}
            </Select> 
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" >
                确认结束
              </Button>
              <Button onClick={() => setDrawModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="退款活动"
        open={refundModalVisible}
        onCancel={() => setRefundModalVisible(false)}
        footer={null}
      >
        <Form
          form={betForm}
          layout="vertical"
          onFinish={handleActivityRefund}
        >
          <Form.Item name='id' label="活动ID">
            {selectedActivity?.id}
          </Form.Item>
          <Form.Item name="description" label="活动描述">
            {selectedActivity?.description}
          </Form.Item>
          <Form.Item name="totalamount" label="当前奖池金额">
            {selectedActivity?.totalAmount} 代币
          </Form.Item>
          <Form.Item name="startTime" label="开始时间">
            {selectedActivity?.startTime}
          </Form.Item>
          <Form.Item name="endTime" label="结束时间">
            {selectedActivity?.endTime}
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" >
                确认退款
              </Button>
              <Button onClick={() => setRefundModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ActivitySquare;