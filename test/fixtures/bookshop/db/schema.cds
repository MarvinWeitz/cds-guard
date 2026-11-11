namespace my.app;

entity Prices {
  key ID     : UUID;
      amount : Decimal(9, 2);
}

entity Orders {
  key ID        : UUID;
      netAmount : Decimal(9, 2) @title: 'Net amount';
      note      : String;
}
