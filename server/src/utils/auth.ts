import { ExpectedError } from '@labrute/core';
import { PrismaClient } from '@labrute/prisma';
import { Request } from 'express';

const auth = async (prisma: PrismaClient, request: Request) => {
  const { headers: { authorization } } = request;

  if (!authorization) {
    throw new ExpectedError('No authorization header');
  }
  if (typeof authorization !== 'string') {
    throw new Error('Invalid authorization header');
  }

  const [id, token] = Buffer.from(authorization.split(' ')[1], 'base64')
    .toString().split(':');

  const user = await prisma.user.findFirst({
    where: {
      id,
      connexionToken: token,
    },
    include: {
      brutes: {
        where: { deletedAt: null },
        include: {
          body: true,
          colors: true,
        },
      },
    },
  });

  if (!user) {
    throw new ExpectedError('User not found');
  }

  return user;
};

export default auth;
