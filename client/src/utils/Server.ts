import Fetch from './Fetch';

export interface User {
  id: number;
  email: string;
  login: string;
  language: string;
  password?: string;
  connexionToken: string;
  createdAt: Date;
  updatedAt: Date;
}

const Server = {
  User: {
    authenticate: (login: string, password: string): Promise<User> => Fetch<User>('/api/user/authenticate', {
      login,
      password
    }, 'POST'),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    list: (): Promise<User[]> => Fetch('/api/user/list', {}, 'GET'),
  }
};

export default Server;