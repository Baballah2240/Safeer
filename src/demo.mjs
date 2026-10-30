// Fictional operators, prices, inventory and passengers. These are not real services.
export function createDemo(now = Date.now()) {
  return {
    companies: [
      {id: 'nile-demo', name: 'Nile Demo Transport', nameAr: 'النيل للنقل - تجريبي', holdMinutes: 30},
      {id: 'coast-demo', name: 'Coast Demo Transport', nameAr: 'الساحل للنقل - تجريبي', holdMinutes: 45},
    ],
    trips: [
      {id: 'nile-01', companyId: 'nile-demo', from: 'Khartoum', to: 'Atbara', departureAt: now + 86400000, capacity: 40, vehicle: 'DEMO BUS 01', fare: 25000, currency: 'SDG', blockedSeats: [2, 3, 7, 12, 18]},
      {id: 'nile-02', companyId: 'nile-demo', from: 'Atbara', to: 'Port Sudan', departureAt: now + 90000000, capacity: 32, vehicle: 'DEMO BUS 02', fare: 30000, currency: 'SDG', blockedSeats: [1, 8, 15]},
      {id: 'coast-01', companyId: 'coast-demo', from: 'Port Sudan', to: 'Atbara', departureAt: now + 93600000, capacity: 40, vehicle: 'DEMO BUS 03', fare: 28000, currency: 'SDG', blockedSeats: [4, 9]},
    ],
    reservations: [
      {id: 'sample-reservation', reference: 'DEMO-SF-0001', companyId: 'nile-demo', tripId: 'nile-01', passengerName: 'Demo passenger', seat: 5, status: 'reserved', createdAt: now, expiresAt: now + 1800000},
    ],
  };
}
