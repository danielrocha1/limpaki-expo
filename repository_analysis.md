# LimpAE Repository Analysis

## Project Overview

**LimpAE** is a comprehensive marketplace platform for domestic cleaning services that connects clients with professional cleaners (diaristas). The platform facilitates service booking, secure payments, and rating systems, creating a trusted ecosystem for both service providers and customers.

## Architecture & Technologies

### Backend (Go/Golang)
- **Framework**: Fiber v2 - High-performance web framework
- **ORM**: GORM - Object-Relational Mapping for database operations
- **Database**: PostgreSQL - Relational database
- **Authentication**: JWT (JSON Web Tokens) for secure authentication
- **File Storage**: Supabase integration for photo uploads
- **Payment Processing**: Stripe integration for secure transactions
- **Deployment**: Configured for Render.com hosting

### Frontend (React.js)
- **Framework**: React 19.0.0-rc.1
- **Routing**: React Router DOM v6
- **Styling**: Custom CSS with modern UI components
- **Maps**: Leaflet & React-Leaflet for geographic features
- **Animations**: Framer Motion for smooth UI transitions
- **Icons**: Lucide React for modern iconography
- **Payment UI**: Stripe React components
- **Calendar**: React Calendar for scheduling

## Core Features

### 1. User Management
- **Dual Role System**: Clients and Diaristas (cleaners)
- **Profile Management**: Photo uploads, bio, experience tracking
- **Address Management**: Multiple addresses per user with geolocation
- **Authentication**: JWT-based secure login system

### 2. Service Marketplace
- **Service Booking**: Schedule cleaning services with duration and pricing
- **Status Tracking**: Service states (pending, in progress, completed, canceled)
- **Geographic Matching**: Find diaristas near user locations using Haversine distance calculation

### 3. Payment System
- **Secure Transactions**: Stripe integration for payment processing
- **Multiple Payment Methods**: Support for various payment options including PIX
- **Payment Status Tracking**: Real-time payment status updates

### 4. Rating & Reviews
- **Bi-directional Reviews**: Both clients and diaristas can rate each other
- **Service Quality Tracking**: 5-star rating system with comments
- **Trust Building**: Public reviews for transparency

### 5. Geographic Features
- **Interactive Maps**: Leaflet-based map showing diarist locations
- **Location Services**: GPS integration for accurate positioning
- **Distance Calculation**: Haversine algorithm for proximity matching

## Database Schema

### Core Models:

```go
// User - Base user entity for both clients and diaristas
type User struct {
    ID           uint
    Name         string
    Photo        string
    Email        string (unique)
    Phone        string (unique)
    Cpf          string (unique)
    PasswordHash string
    Role         string // 'cliente' or 'diarista'
    CreatedAt    time.Time
}

// Service - Core business entity
type Service struct {
    ID            uint
    ClientID      uint
    DiaristID     uint
    AddressID     uint
    Status        string // 'pendente', 'em andamento', 'concluído', 'cancelado'
    TotalPrice    float64
    DurationHours float64
    ScheduledAt   time.Time
    CompletedAt   *time.Time
}

// Payment - Transaction management
type Payment struct {
    ID        uint
    ServiceID uint
    Amount    float64
    Status    string // 'pendente', 'concluído', 'cancelado'
    Method    string
    PaidAt    *time.Time
}
```

## API Endpoints

The API follows RESTful conventions with the following main endpoints:

- **Users**: `/api/users` - User management (CRUD)
- **Addresses**: `/api/addresses` - Address management
- **Diaristas**: `/api/diarists` - Diarist profiles
- **Services**: `/api/services` - Service booking and management
- **Payments**: `/api/payments` - Payment processing
- **Reviews**: `/api/reviews` - Rating and review system

## Frontend Architecture

### Component Structure:
- **Header**: Navigation, address selection, user menu
- **Forms**: Registration, login, address forms
- **Dashboard**: User dashboard with service overview
- **Map Components**: Interactive map with diarist locations
- **Service Management**: Booking and tracking interfaces

### State Management:
- **Context API**: Address management and user authentication
- **Local Storage**: Token persistence for authentication

## Key Features Implementation

### 1. Authentication Flow
- JWT token-based authentication
- Role-based access control (client/diarist)
- Automatic token validation and refresh

### 2. Geolocation Services
- Real-time location tracking
- Distance-based diarist matching
- Interactive map interface with markers

### 3. Service Booking Process
1. Client selects address and service requirements
2. System finds nearby available diaristas
3. Client books service with scheduling
4. Payment processing through Stripe
5. Service tracking and completion
6. Mutual rating system

### 4. File Upload System
- Supabase integration for photo storage
- Automatic file naming with user IDs
- Secure URL generation for profile photos

## Development & Deployment

### Backend Configuration:
- Environment-based configuration
- CORS middleware for cross-origin requests
- Request logging middleware
- Health check endpoint with automatic keep-alive

### Database Management:
- GORM migrations for schema management
- Foreign key constraints for data integrity
- Indexed fields for performance optimization

### Security Features:
- Password hashing with bcrypt
- JWT token validation
- CORS protection
- Input validation and sanitization

## Code Quality & Organization

### Backend Structure:
```
go/
├── src/
│   ├── config/     # Database configuration
│   ├── controllers/ # Business logic
│   ├── models/     # Data models
│   ├── routes/     # API routing
│   └── utils/      # Helper functions
└── main.go         # Application entry point
```

### Frontend Structure:
```
src/
├── components/     # Reusable UI components
├── context/        # State management
├── forms/          # Form components
├── dashboard/      # Dashboard interface
├── diaristmap/     # Map functionality
└── services/       # Service management
```

## Strengths

1. **Full-Stack Solution**: Complete marketplace with both frontend and backend
2. **Modern Tech Stack**: Uses current best practices and frameworks
3. **Scalable Architecture**: Clean separation of concerns
4. **Security Focus**: JWT authentication and secure payment processing
5. **Geographic Features**: Sophisticated location-based matching
6. **Payment Integration**: Production-ready Stripe implementation
7. **User Experience**: Modern, responsive UI with smooth animations

## Areas for Improvement

1. **Error Handling**: Could benefit from more comprehensive error handling
2. **Testing**: No visible test suite implementation
3. **Documentation**: API documentation could be more detailed
4. **Validation**: More robust input validation on both frontend and backend
5. **Caching**: No evident caching strategy for improved performance
6. **Monitoring**: Lacks application monitoring and logging infrastructure

## Conclusion

LimpAE is a well-architected marketplace platform that demonstrates modern full-stack development practices. The project successfully combines a robust Go backend with a responsive React frontend to create a functional cleaning service marketplace. The implementation of geographic features, payment processing, and user management shows professional-level development skills.

The codebase is organized, follows best practices, and implements essential features for a marketplace platform. With some enhancements in testing, error handling, and documentation, this could be a production-ready application.