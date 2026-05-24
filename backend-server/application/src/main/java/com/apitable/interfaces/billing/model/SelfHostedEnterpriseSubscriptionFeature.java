/*
 * APITable <https://github.com/apitable/apitable>
 * Copyright (C) 2022 APITable Ltd. <https://apitable.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package com.apitable.interfaces.billing.model;

import com.apitable.interfaces.billing.model.SubscriptionFeatures.ConsumeFeatures.AiAgentNums;
import com.apitable.interfaces.billing.model.SubscriptionFeatures.ConsumeFeatures.ApiQpsNums;
import com.apitable.interfaces.billing.model.SubscriptionFeatures.ConsumeFeatures.CapacitySize;
import com.apitable.interfaces.billing.model.SubscriptionFeatures.ConsumeFeatures.ColumnsPerSheet;
import com.apitable.interfaces.billing.model.SubscriptionFeatures.ConsumeFeatures.DashboardNums;
import com.apitable.interfaces.billing.model.SubscriptionFeatures.ConsumeFeatures.MessageCreditNums;
import com.apitable.interfaces.billing.model.SubscriptionFeatures.ConsumeFeatures.SnapshotNumsPerSheet;
import com.apitable.interfaces.billing.model.SubscriptionFeatures.SubscribeFeatures.AuditQuery;

/**
 * Enterprise-like feature set for legal self-hosted deployments.
 */
public class SelfHostedEnterpriseSubscriptionFeature extends DefaultSubscriptionFeature {

    /**
     * Use a huge positive number for byte capacity because several call sites do arithmetic on bytes.
     * Numeric quota features can safely use -1 because NumberPlanFeature treats -1 as unlimited.
     */
    private static final long HUGE_CAPACITY_BYTES = 1024L * 1024L * 1024L * 1024L * 1024L;

    private static final long HUGE_RATE_LIMIT = 1_000_000L;

    @Override
    public SubscriptionFeatures.ConsumeFeatures.Seat getSeat() {
        return new SubscriptionFeatures.ConsumeFeatures.Seat(-1L);
    }

    @Override
    public CapacitySize getCapacitySize() {
        return new CapacitySize(HUGE_CAPACITY_BYTES);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.FileNodeNums getFileNodeNums() {
        return new SubscriptionFeatures.ConsumeFeatures.FileNodeNums(-1L);
    }

    @Override
    public ColumnsPerSheet getColumnsPerSheet() {
        return new ColumnsPerSheet(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.RowsPerSheet getRowsPerSheet() {
        return new SubscriptionFeatures.ConsumeFeatures.RowsPerSheet(-1L);
    }

    @Override
    public SnapshotNumsPerSheet getSnapshotNumsPerSheet() {
        return new SnapshotNumsPerSheet(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.ArchivedRowsPerSheet getArchivedRowsPerSheet() {
        return new SubscriptionFeatures.ConsumeFeatures.ArchivedRowsPerSheet(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.TotalRows getTotalRows() {
        return new SubscriptionFeatures.ConsumeFeatures.TotalRows(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.MirrorNums getMirrorNums() {
        return new SubscriptionFeatures.ConsumeFeatures.MirrorNums(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.AdminNums getAdminNums() {
        return new SubscriptionFeatures.ConsumeFeatures.AdminNums(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.ApiCallNumsPerMonth getApiCallNumsPerMonth() {
        return new SubscriptionFeatures.ConsumeFeatures.ApiCallNumsPerMonth(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.GalleryViewNums getGalleryViewNums() {
        return new SubscriptionFeatures.ConsumeFeatures.GalleryViewNums(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.KanbanViewNums getKanbanViewNums() {
        return new SubscriptionFeatures.ConsumeFeatures.KanbanViewNums(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.ArchitectureViewNums getArchitectureViewNums() {
        return new SubscriptionFeatures.ConsumeFeatures.ArchitectureViewNums(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.GanttViewNums getGanttViewNums() {
        return new SubscriptionFeatures.ConsumeFeatures.GanttViewNums(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.CalendarViewNums getCalendarViewNums() {
        return new SubscriptionFeatures.ConsumeFeatures.CalendarViewNums(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.FormNums getFormNums() {
        return new SubscriptionFeatures.ConsumeFeatures.FormNums(-1L);
    }

    @Override
    public DashboardNums getDashboardNums() {
        return new DashboardNums(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.FieldPermissionNums getFieldPermissionNums() {
        return new SubscriptionFeatures.ConsumeFeatures.FieldPermissionNums(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.NodePermissionNums getNodePermissionNums() {
        return new SubscriptionFeatures.ConsumeFeatures.NodePermissionNums(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.WidgetNums getWidgetNums() {
        return new SubscriptionFeatures.ConsumeFeatures.WidgetNums(-1L);
    }

    @Override
    public AiAgentNums getAiAgentNums() {
        return new AiAgentNums(-1L);
    }

    @Override
    public MessageCreditNums getMessageCreditNums() {
        return new MessageCreditNums(-1L);
    }

    @Override
    public SubscriptionFeatures.ConsumeFeatures.AutomationRunNumsPerMonth getAutomationRunNumsPerMonth() {
        return new SubscriptionFeatures.ConsumeFeatures.AutomationRunNumsPerMonth(-1L);
    }

    @Override
    public ApiQpsNums getApiQpsNums() {
        return new ApiQpsNums(HUGE_RATE_LIMIT);
    }

    @Override
    public SubscriptionFeatures.SubscribeFeatures.SocialConnect getSocialConnect() {
        return new SubscriptionFeatures.SubscribeFeatures.SocialConnect(true);
    }

    @Override
    public SubscriptionFeatures.SubscribeFeatures.RainbowLabel getRainbowLabel() {
        return new SubscriptionFeatures.SubscribeFeatures.RainbowLabel(true);
    }

    @Override
    public SubscriptionFeatures.SubscribeFeatures.Watermark getWatermark() {
        return new SubscriptionFeatures.SubscribeFeatures.Watermark(true);
    }

    @Override
    public SubscriptionFeatures.SubscribeFeatures.AllowInvitation getAllowInvitation() {
        return new SubscriptionFeatures.SubscribeFeatures.AllowInvitation(true);
    }

    @Override
    public SubscriptionFeatures.SubscribeFeatures.AllowApplyJoin getAllowApplyJoin() {
        return new SubscriptionFeatures.SubscribeFeatures.AllowApplyJoin(true);
    }

    @Override
    public SubscriptionFeatures.SubscribeFeatures.AllowShare getAllowShare() {
        return new SubscriptionFeatures.SubscribeFeatures.AllowShare(true);
    }

    @Override
    public SubscriptionFeatures.SubscribeFeatures.AllowExport getAllowExport() {
        return new SubscriptionFeatures.SubscribeFeatures.AllowExport(true);
    }

    @Override
    public SubscriptionFeatures.SubscribeFeatures.AllowDownload getAllowDownload() {
        return new SubscriptionFeatures.SubscribeFeatures.AllowDownload(true);
    }

    @Override
    public SubscriptionFeatures.SubscribeFeatures.AllowCopyData getAllowCopyData() {
        return new SubscriptionFeatures.SubscribeFeatures.AllowCopyData(true);
    }

    @Override
    public SubscriptionFeatures.SubscribeFeatures.AllowEmbed getAllowEmbed() {
        return new SubscriptionFeatures.SubscribeFeatures.AllowEmbed(true);
    }

    @Override
    public SubscriptionFeatures.SubscribeFeatures.AllowOrgApi getAllowOrgApi() {
        return new SubscriptionFeatures.SubscribeFeatures.AllowOrgApi(true);
    }

    @Override
    public AuditQuery getAuditQuery() {
        return new AuditQuery(true);
    }

    @Override
    public SubscriptionFeatures.SubscribeFeatures.ControlFormBrandLogo getControlFormBrandLogo() {
        return new SubscriptionFeatures.SubscribeFeatures.ControlFormBrandLogo(true);
    }

    @Override
    public SubscriptionFeatures.SolidFeatures.RemainTrashDays getRemainTrashDays() {
        return new SubscriptionFeatures.SolidFeatures.RemainTrashDays(-1L);
    }

    @Override
    public SubscriptionFeatures.SolidFeatures.RemainTimeMachineDays getRemainTimeMachineDays() {
        return new SubscriptionFeatures.SolidFeatures.RemainTimeMachineDays(-1L);
    }

    @Override
    public SubscriptionFeatures.SolidFeatures.RemainRecordActivityDays getRemainRecordActivityDays() {
        return new SubscriptionFeatures.SolidFeatures.RemainRecordActivityDays(-1L);
    }

    @Override
    public SubscriptionFeatures.SolidFeatures.AuditQueryDays getAuditQueryDays() {
        return new SubscriptionFeatures.SolidFeatures.AuditQueryDays(-1L);
    }
}
