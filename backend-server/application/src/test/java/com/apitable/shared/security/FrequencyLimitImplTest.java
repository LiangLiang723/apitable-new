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

package com.apitable.shared.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.util.Lists.list;
import static org.junit.Assert.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;

import com.apitable.AbstractIntegrationTest;
import com.apitable.core.exception.BusinessException;
import com.apitable.mock.bean.MockUserSpace;
import com.apitable.space.entity.SpaceInviteRecordEntity;
import com.apitable.space.mapper.SpaceInviteRecordMapper;
import com.apitable.starter.mail.autoconfigure.EmailMessage;
import com.apitable.workspace.enums.NodeType;
import com.apitable.workspace.ro.NodeOpRo;
import jakarta.annotation.Resource;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * member service test
 *
 * @author Shawn Deng
 */
public class FrequencyLimitImplTest extends AbstractIntegrationTest {

    @Autowired
    private IFrequencyLimitService iFrequencyLimitService;

    @Test
    void testShouldNotPreventInvitationForFreeSpace() {
        MockUserSpace mockUserSpace = createSingleUserAndSpace();
        for (int i = 0; i < 9; i++) {
            iFrequencyLimitService.spaceInviteFrequency(mockUserSpace.getSpaceId());
        }
        assertThrows(BusinessException.class,
            () -> iFrequencyLimitService.spaceInviteFrequency(mockUserSpace.getSpaceId()));
    }
}
