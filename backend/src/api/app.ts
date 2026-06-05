import express from 'express';
import path from 'path';
import cors from 'cors';
import * as OpenApiValidator from 'express-openapi-validator';
import { authMiddleware } from './middleware/auth';
import { errorMiddleware } from './middleware/error';
import { createPurchaseOrdersRouter } from './routes/purchase-orders';
import { PurchaseOrderService } from '../services/purchase-order.service';

export function createApp(poService: PurchaseOrderService): express.Application {
  const app = express();

  app.use(cors({ origin: 'http://localhost:5173' }));
  app.use(express.json());
  app.use(authMiddleware);

  app.use(
    OpenApiValidator.middleware({
      apiSpec: path.join(__dirname, '../../openapi.yaml'),
      validateRequests: true,
      validateResponses: false,
    }),
  );

  app.use('/api/v1/purchase-orders', createPurchaseOrdersRouter(poService));
  app.use(errorMiddleware);

  return app;
}
