import { getDb } from "./db";
import { partnerCompanies, fleetOwnerNotifications } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Fleet Owner Email Notification System
 * 
 * Sends emails when Fleet Owner application status changes:
 * - Submitted: Confirmation + link to status page
 * - Approved: Welcome + link to dashboard
 * - Rejected: Polite rejection + next steps
 * 
 * Duplicate prevention: Tracks last notification type sent per application
 */

interface EmailNotificationResult {
  success: boolean;
  error?: string;
}

/**
 * Send application submitted confirmation email
 */
export async function sendApplicationSubmittedEmail(
  email: string,
  companyName: string,
  applicationId: number
): Promise<EmailNotificationResult> {
  try {
    console.log(`[Fleet Owner Email] Sending submission confirmation to ${email}`);

    const statusUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || 'https://apiamway-96zj69hn.manus.space'}/fleet-owner/status`;

    const emailContent = `
      <h2>Application Received</h2>
      <p>Dear ${companyName},</p>
      <p>Thank you for applying to become a Fleet Owner with Apiamway. We have received your application and our team will review it shortly.</p>
      
      <h3>What happens next?</h3>
      <ul>
        <li>Our team will review your application within 2-3 business days</li>
        <li>You will receive an email notification once your application is approved or if we need additional information</li>
        <li>You can track your application status anytime using the link below</li>
      </ul>
      
      <p><a href="${statusUrl}" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Check Application Status</a></p>
      
      <p><strong>Note:</strong> While your application is pending, you can still use Apiamway to send packages as a Shipper.</p>
      
      <p>Best regards,<br>The Apiamway Team</p>
    `;

    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    // For now, log the email content
    console.log(`[Fleet Owner Email] Email content:`, emailContent);

    // Update last notification sent
    await updateLastNotification(applicationId, 'submitted', email);

    return { success: true };
  } catch (error) {
    console.error(`[Fleet Owner Email] Failed to send submission email:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send application approved email
 */
export async function sendApplicationApprovedEmail(
  email: string,
  companyName: string,
  applicationId: number
): Promise<EmailNotificationResult> {
  try {
    console.log(`[Fleet Owner Email] Sending approval notification to ${email}`);

    const dashboardUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || 'https://apiamway-96zj69hn.manus.space'}/fleet-owner/dashboard`;

    const emailContent = `
      <h2>🎉 Application Approved!</h2>
      <p>Dear ${companyName},</p>
      <p>Congratulations! Your Fleet Owner application has been approved. You can now start adding your bikes and riders to earn from deliveries on Apiamway.</p>
      
      <h3>Getting Started</h3>
      <ul>
        <li><strong>Add Your Fleet:</strong> Register your bikes and riders in the Fleet Owner dashboard</li>
        <li><strong>Receive Dispatch Jobs:</strong> Once approved, your riders will start receiving delivery assignments</li>
        <li><strong>Track Earnings:</strong> Monitor your earnings in real-time</li>
        <li><strong>Weekly Payouts:</strong> Earnings are paid out every Friday to your wallet</li>
      </ul>
      
      <p><a href="${dashboardUrl}" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Go to Fleet Owner Dashboard</a></p>
      
      <h3>Earning Model</h3>
      <p>You earn the <strong>full trip revenue</strong> minus Apiamway's commission for fleet management, dispatch, tracking, and payment processing. Earnings accumulate in your wallet and are paid out every Friday.</p>
      
      <p>Welcome to the Apiamway Fleet Owner network!</p>
      
      <p>Best regards,<br>The Apiamway Team</p>
    `;

    // TODO: Integrate with actual email service
    console.log(`[Fleet Owner Email] Email content:`, emailContent);

    // Update last notification sent
    await updateLastNotification(applicationId, 'approved', email);

    return { success: true };
  } catch (error) {
    console.error(`[Fleet Owner Email] Failed to send approval email:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send application rejected email
 */
export async function sendApplicationRejectedEmail(
  email: string,
  companyName: string,
  applicationId: number,
  reason?: string
): Promise<EmailNotificationResult> {
  try {
    console.log(`[Fleet Owner Email] Sending rejection notification to ${email}`);

    const contactUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || 'https://apiamway-96zj69hn.manus.space'}/contact`;

    const emailContent = `
      <h2>Application Update</h2>
      <p>Dear ${companyName},</p>
      <p>Thank you for your interest in becoming a Fleet Owner with Apiamway. After careful review, we are unable to approve your application at this time.</p>
      
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      
      <h3>Next Steps</h3>
      <ul>
        <li>You can continue using Apiamway to send packages as a Shipper</li>
        <li>If you believe this decision was made in error, please contact our support team</li>
        <li>You may reapply after addressing any concerns mentioned above</li>
      </ul>
      
      <p><a href="${contactUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Contact Support</a></p>
      
      <p>We appreciate your understanding.</p>
      
      <p>Best regards,<br>The Apiamway Team</p>
    `;

    // TODO: Integrate with actual email service
    console.log(`[Fleet Owner Email] Email content:`, emailContent);

    // Update last notification sent
    await updateLastNotification(applicationId, 'rejected', email);

    return { success: true };
  } catch (error) {
    console.error(`[Fleet Owner Email] Failed to send rejection email:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Update last notification sent to prevent duplicates
 * Records notification in fleetOwnerNotifications table
 */
async function updateLastNotification(
  applicationId: number,
  notificationType: 'submitted' | 'approved' | 'rejected',
  email: string
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.error(`[Fleet Owner Email] Database connection failed`);
      return;
    }

    await db.insert(fleetOwnerNotifications).values({
      partnerCompanyId: applicationId,
      notificationType,
      email,
    });

    console.log(`[Fleet Owner Email] Recorded notification for application ${applicationId}: ${notificationType}`);
  } catch (error) {
    console.error(`[Fleet Owner Email] Failed to record notification:`, error);
    // Don't throw - notification tracking is non-critical
  }
}

/**
 * Check if notification has already been sent to prevent duplicates
 */
export async function hasNotificationBeenSent(
  applicationId: number,
  notificationType: 'submitted' | 'approved' | 'rejected'
): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.error(`[Fleet Owner Email] Database connection failed`);
      return false;
    }

    const [notification] = await db
      .select()
      .from(fleetOwnerNotifications)
      .where(
        and(
          eq(fleetOwnerNotifications.partnerCompanyId, applicationId),
          eq(fleetOwnerNotifications.notificationType, notificationType)
        )
      )
      .orderBy(desc(fleetOwnerNotifications.sentAt))
      .limit(1);

    return !!notification;
  } catch (error) {
    console.error(`[Fleet Owner Email] Failed to check notification status:`, error);
    return false; // Assume not sent to avoid blocking emails
  }
}
