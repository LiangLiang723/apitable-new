package com.apitable.shared.listener;

import com.apitable.shared.listener.event.AuditSpaceEvent;
import com.apitable.space.service.ISpaceAuditRecordService;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Persist space audit events for self-hosted deployments.
 */
@Slf4j
@Component
public class SpaceAuditEventListener implements ApplicationListener<AuditSpaceEvent> {

    @Resource
    private ISpaceAuditRecordService iSpaceAuditRecordService;

    @Override
    @Async
    public void onApplicationEvent(AuditSpaceEvent event) {
        try {
            iSpaceAuditRecordService.save(event.getArg());
        } catch (Exception exception) {
            log.warn("persist space audit event failed", exception);
        }
    }
}