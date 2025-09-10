export interface CarAddress {
  state: string;
  city: string;
  locality: string;
}

export interface CarDetails {
  id: string;
  availableFor: 'Sale' | 'Buy';
  address: CarAddress;
  category: 'New' | 'Used' | 'Luxury';
}
