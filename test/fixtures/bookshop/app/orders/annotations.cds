using my.app from '../../db/schema';

annotate app.Orders with @UI: {
  LineItem  : [{ Value: netAmount }],
  HeaderInfo: { TypeName: 'Order', TypeNamePlural: 'Orders' }
};
