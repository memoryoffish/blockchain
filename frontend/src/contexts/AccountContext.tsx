import React, { createContext, useState, useContext } from 'react';

interface AccountContextType {
  account: string;
  managerAccount: string;
  setAccount: (account: string) => void;
  setManagerAccount: (managerAccount: string) => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState('');
  const [managerAccount, setManagerAccount] = useState('');
//   console.log('AccountProvider is rendering');
  return (
    <AccountContext.Provider value={{ account, managerAccount, setAccount, setManagerAccount }}>
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = (): AccountContextType => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
};