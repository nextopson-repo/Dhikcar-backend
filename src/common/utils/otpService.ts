export const verifyOTP = async (mobileNumber: string, otp: string, otpType: string): Promise<boolean> => {
  // In a real application, you would implement actual OTP verification logic here.
  // This is a placeholder for development purposes.
  console.log(`Verifying OTP for ${mobileNumber} with type ${otpType}: ${otp}`);
  // For now, let's assume any non-empty OTP is valid.
  return otp.length === 4;
};
