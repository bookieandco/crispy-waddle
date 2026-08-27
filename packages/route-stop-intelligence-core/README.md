# Route & Stop Intelligence Core

Provider-neutral route and stop intelligence for TruckeroOS / Exit-45.

## Boundary

`Route & Stop Intelligence Core` sits beside the freight marketplace and Dispatcher economics engine. It consumes normalized route context and provider-neutral stop observations; it does not own freight offers, bookings, payments, ELD state, or transportation execution.

The intended flow is:

`StopDataSource → StopRegistry → Normalized Stop → Logistics Qualification → Route Context → DriverStopRecommendation`

## Core contracts

- `Route`
- `RouteSegment`
- `Corridor`
- `Stop`
- `ParkingProfile`
- `ParkingStatus`
- `AccessConstraint`
- `Amenity`
- `TransitAccess`
- `LifestyleVenue`
- `DriverStopRecommendation`
- `StopDataSource`
- `StopRegistry`

## Qualification order

A stop is not recommended because it is merely nearby. The deterministic qualification path checks:

1. equipment can legally/accessibly park;
2. verified access constraints do not block the equipment;
3. infrastructure data is not stale;
4. parking status supports arrival;
5. requested mobility is actually available;
6. security, amenities, corridor preference, and downtime can improve ranking.

Stale or uncertain data produces a `conditional` result or warning rather than silently becoming verified.

## Provider isolation

Parking, mapping, municipal restrictions, transit, lifestyle, and future commercial sources implement `StopDataSource`. Provider-specific response shapes stop at the adapter boundary and become the normalized `Stop` contract before ranking.

This makes future DAT/Truckstop freight context, ELD context, parking feeds, maps, and local venue sources composable without contaminating Dispatcher economics or Marketplace Core.

## Safety boundary

This package only evaluates and recommends. It does not:

- book freight or transportation;
- contact shippers, brokers, venues, or rideshare providers;
- change ELD status;
- route a truck through an unverified restriction;
- move money;
- authorize a Marketplace booking.

The next integration layer can feed a ranked load's route into this package and then surface qualified Exit-45 stops to the driver.
