const { socketAuth } = require('./middleware/socketAuth');
const { EmergencyRequest, User, DonationHistory } = require('./models');

const setupSocketHandlers = (io) => {
  // Apply authentication middleware
  io.use(socketAuth);

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`👤 User connected: ${user.name} (${user.role}) - Socket ID: ${socket.id}`);

    // Join user to their personal room
    socket.join(`user-${user._id}`);

    // Role-based room joining
    if (user.role === 'donor' && user.admin.isApproved) {
      socket.join(`donor-${user._id}`);
      socket.join('donors-global');
      
      // Join location-based room
      if (user.address && user.address.city) {
        socket.join(`donors-${user.address.city.toLowerCase()}`);
      }
      
      // Join blood group room
      if (user.medicalInfo && user.medicalInfo.bloodGroup) {
        socket.join(`donors-${user.medicalInfo.bloodGroup}`);
      }
      
      console.log(`🩸 Donor joined rooms: donor-${user._id}, donors-${user.address?.city}, donors-${user.medicalInfo?.bloodGroup}`);
    }

    if (user.role === 'recipient') {
      socket.join(`recipient-${user._id}`);
      socket.join('recipients-global');
      console.log(`🏥 Recipient joined rooms: recipient-${user._id}`);
    }

    if (user.role === 'admin') {
      socket.join('admin-room');
      socket.join('admins-global');
      console.log(`👨‍💼 Admin joined admin rooms`);
    }

    // Handle donor availability updates
    socket.on('update-availability', async (data) => {
      try {
        if (user.role !== 'donor') return;

        await User.findByIdAndUpdate(user._id, {
          'availability.isAvailable': data.isAvailable,
          'availability.availableFrom': data.availableFrom ? new Date(data.availableFrom) : null
        });

        // Notify admins of availability change
        socket.to('admin-room').emit('donor-availability-updated', {
          donorId: user._id,
          donorName: user.name,
          isAvailable: data.isAvailable,
          bloodGroup: user.medicalInfo.bloodGroup,
          city: user.address.city,
          timestamp: new Date()
        });

        socket.emit('availability-updated', { success: true });
        console.log(`📊 Donor ${user.name} updated availability: ${data.isAvailable}`);

      } catch (error) {
        socket.emit('error', { message: 'Failed to update availability' });
      }
    });

    // Handle emergency request notifications
    socket.on('emergency-request-created', async (requestData) => {
      try {
        if (user.role !== 'recipient') return;

        const emergencyRequest = await EmergencyRequest.findById(requestData.requestId)
          .populate('requester', 'name phone email');

        if (!emergencyRequest) return;

        // Notify eligible donors
        const notificationData = {
          requestId: emergencyRequest._id,
          patient: emergencyRequest.patient,
          medical: emergencyRequest.medical,
          hospital: emergencyRequest.hospital,
          requester: emergencyRequest.requester,
          timestamp: new Date()
        };

        // Send to donors with matching blood group
        socket.to(`donors-${emergencyRequest.patient.bloodGroup}`).emit('new-emergency-request', notificationData);

        // Send to donors in the same city
        if (emergencyRequest.hospital.address.city) {
          socket.to(`donors-${emergencyRequest.hospital.address.city.toLowerCase()}`).emit('new-emergency-request', notificationData);
        }

        // Notify all admins
        socket.to('admin-room').emit('new-emergency-request', notificationData);

        console.log(`🚨 Emergency request broadcast for ${emergencyRequest.patient.bloodGroup} in ${emergencyRequest.hospital.address.city}`);

      } catch (error) {
        socket.emit('error', { message: 'Failed to broadcast emergency request' });
      }
    });

    // Handle donor responses to emergency requests
    socket.on('donor-response', async (responseData) => {
      try {
        if (user.role !== 'donor') return;

        const emergencyRequest = await EmergencyRequest.findById(responseData.requestId)
          .populate('requester', 'name phone email');

        if (!emergencyRequest) return;

        const notificationData = {
          requestId: responseData.requestId,
          donorId: user._id,
          donorName: user.name,
          donorBloodGroup: user.medicalInfo.bloodGroup,
          responseType: responseData.responseType,
          notes: responseData.notes,
          timestamp: new Date()
        };

        // Notify the requester
        socket.to(`recipient-${emergencyRequest.requester._id}`).emit('donor-response', notificationData);

        // Notify admins
        socket.to('admin-room').emit('donor-response', notificationData);

        console.log(`✅ Donor ${user.name} responded to emergency request: ${responseData.responseType}`);

      } catch (error) {
        socket.emit('error', { message: 'Failed to send response notification' });
      }
    });

    // Handle donation scheduling
    socket.on('donation-scheduled', async (scheduleData) => {
      try {
        if (user.role !== 'recipient') return;

        const donationHistory = await DonationHistory.findById(scheduleData.donationId)
          .populate('donor', 'name phone email')
          .populate('emergencyRequest', 'patient.name hospital.name');

        if (!donationHistory) return;

        const notificationData = {
          donationId: scheduleData.donationId,
          scheduledDate: scheduleData.scheduledDate,
          hospital: donationHistory.scheduling.location,
          patient: donationHistory.emergencyRequest.patient,
          recipient: user.name,
          timestamp: new Date()
        };

        // Notify the selected donor
        socket.to(`donor-${donationHistory.donor._id}`).emit('donation-scheduled', notificationData);

        // Notify admins
        socket.to('admin-room').emit('donation-scheduled', notificationData);

        console.log(`📅 Donation scheduled between ${donationHistory.donor.name} and ${user.name}`);

      } catch (error) {
        socket.emit('error', { message: 'Failed to send scheduling notification' });
      }
    });

    // Handle donation completion
    socket.on('donation-completed', async (completionData) => {
      try {
        if (user.role !== 'admin' && user.role !== 'donor') return;

        const donationHistory = await DonationHistory.findById(completionData.donationId)
          .populate('donor', 'name phone email')
          .populate('recipient', 'name phone email')
          .populate('emergencyRequest', 'patient.name');

        if (!donationHistory) return;

        const notificationData = {
          donationId: completionData.donationId,
          donor: donationHistory.donor,
          recipient: donationHistory.recipient,
          patient: donationHistory.emergencyRequest.patient,
          completedAt: new Date(),
          notes: completionData.notes
        };

        // Notify donor (if admin completed it)
        if (user.role === 'admin') {
          socket.to(`donor-${donationHistory.donor._id}`).emit('donation-completed', notificationData);
        }

        // Notify recipient
        socket.to(`recipient-${donationHistory.recipient._id}`).emit('donation-completed', notificationData);

        // Notify all admins
        socket.to('admin-room').emit('donation-completed', notificationData);

        console.log(`🎉 Donation completed: ${donationHistory.donor.name} → ${donationHistory.recipient.name}`);

      } catch (error) {
        socket.emit('error', { message: 'Failed to send completion notification' });
      }
    });

    // Handle admin broadcast messages
    socket.on('admin-broadcast', async (broadcastData) => {
      try {
        if (user.role !== 'admin') return;

        const { target, message, urgency, bloodGroup, city } = broadcastData;

        const notificationData = {
          message,
          urgency,
          broadcastBy: user.name,
          timestamp: new Date()
        };

        switch (target) {
          case 'all-donors':
            socket.to('donors-global').emit('admin-broadcast', notificationData);
            break;
          
          case 'blood-group':
            if (bloodGroup) {
              socket.to(`donors-${bloodGroup}`).emit('admin-broadcast', notificationData);
            }
            break;
          
          case 'city':
            if (city) {
              socket.to(`donors-${city.toLowerCase()}`).emit('admin-broadcast', notificationData);
            }
            break;
          
          case 'all-recipients':
            socket.to('recipients-global').emit('admin-broadcast', notificationData);
            break;
          
          default:
            socket.to('donors-global').emit('admin-broadcast', notificationData);
            socket.to('recipients-global').emit('admin-broadcast', notificationData);
        }

        console.log(`📢 Admin ${user.name} broadcast to ${target}: ${message}`);

      } catch (error) {
        socket.emit('error', { message: 'Failed to send broadcast' });
      }
    });

    // Handle user typing indicators (for chat features)
    socket.on('typing', (data) => {
      socket.to(data.room).emit('user-typing', {
        userId: user._id,
        userName: user.name,
        isTyping: data.isTyping
      });
    });

    // Handle user status updates
    socket.on('status-update', (statusData) => {
      // Broadcast user online/offline status to relevant rooms
      const statusNotification = {
        userId: user._id,
        userName: user.name,
        userRole: user.role,
        status: statusData.status,
        timestamp: new Date()
      };

      if (user.role === 'donor') {
        socket.to('admin-room').emit('donor-status-update', statusNotification);
      } else if (user.role === 'recipient') {
        socket.to('admin-room').emit('recipient-status-update', statusNotification);
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`👋 User disconnected: ${user.name} (${user.role}) - Reason: ${reason}`);
      
      // Notify relevant rooms about user going offline
      const disconnectNotification = {
        userId: user._id,
        userName: user.name,
        userRole: user.role,
        status: 'offline',
        timestamp: new Date(),
        reason
      };

      if (user.role === 'donor') {
        socket.to('admin-room').emit('donor-status-update', disconnectNotification);
      } else if (user.role === 'recipient') {
        socket.to('admin-room').emit('recipient-status-update', disconnectNotification);
      }
    });

    // Send welcome message
    socket.emit('connected', {
      message: `Welcome ${user.name}! You are now connected to BloodFinder real-time system.`,
      userRole: user.role,
      userId: user._id,
      timestamp: new Date()
    });
  });

  // Handle connection errors
  io.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });
};

module.exports = { setupSocketHandlers };
