package com.apitable.shared.security;

import cn.hutool.core.date.DateUnit;
import cn.hutool.core.date.DateUtil;
import com.apitable.core.constants.RedisConstants;
import com.apitable.core.exception.BusinessException;
import com.apitable.interfaces.billing.facade.EntitlementServiceFacade;
import com.apitable.interfaces.billing.model.SubscriptionInfo;
import com.apitable.shared.config.properties.LimitProperties;
import jakarta.annotation.Resource;
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import org.springframework.data.redis.core.BoundSetOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Frequency Limit Service Implementation.
 */
@Service
public class FrequencyLimitServiceImpl implements IFrequencyLimitService {

    @Resource
    private EntitlementServiceFacade entitlementServiceFacade;

    @Resource
    private LimitProperties limitProperties;

    @Resource
    private RedisTemplate<String, Long> redisTemplate;

    @Override
    public void spaceInviteFrequency(String spaceId) {
        SubscriptionInfo subscriptionInfo =
            entitlementServiceFacade.getSpaceSubscription(spaceId);
        var seatNums = subscriptionInfo.getFeature().getSeat();
        if (!subscriptionInfo.isFree() || seatNums.isUnlimited()) {
            return;
        }
        String repeatKey = RedisConstants.getGeneralFrequencyRecordOfInvite(spaceId);
        BoundSetOperations<String, Long> ops = redisTemplate.boundSetOps(repeatKey);
        ops.add(DateUtil.current());
        ops.expire(1, TimeUnit.DAYS);

        long repeatNum = Objects.requireNonNull(ops.members()).stream()
            .filter(val -> DateUtil.between(DateUtil.date(), DateUtil.date(val), DateUnit.DAY) < 1)
            .count();
        if (repeatNum > limitProperties.getMaxInviteCountForFree()) {
            throw new BusinessException("Frequent operation");
        }
    }
}
