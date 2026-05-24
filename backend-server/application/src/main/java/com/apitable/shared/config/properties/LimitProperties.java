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

package com.apitable.shared.config.properties;

import static com.apitable.shared.config.properties.LimitProperties.PREFIX_LIMIT;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;


/**
 * <p>
 * limitation properties.
 * </p>
 *
 * @author Chambers
 */
@Data
@ConfigurationProperties(prefix = PREFIX_LIMIT)
public class LimitProperties {

    public static final String PREFIX_LIMIT = "limit";

    private static final Integer UNLIMITED_INT = Integer.MAX_VALUE;

    private static final Long UNLIMITED_LONG = Long.MAX_VALUE;

    /**
     * Maximum user space.
     */
    private Integer spaceMaxCount = UNLIMITED_INT;

    /**
     * Maximum file size of imported data table.
     */
    private Integer maxFileSize = UNLIMITED_INT;

    /**
     * Maximum number of columns in the number table.
     */
    private Integer maxColumnCount = UNLIMITED_INT;

    /**
     * Maximum Views.
     */
    @Deprecated
    private Integer viewMaxCount = UNLIMITED_INT;

    /**
     * Maximum number of templates.
     */
    private Integer templateMaxCount = UNLIMITED_INT;

    /**
     * Maximum loading numbers of member field in datasheet.
     */
    private Integer memberFieldMaxLoadCount = UNLIMITED_INT;

    /**
     * Maximum rows.
     */
    private Integer maxRowCount = UNLIMITED_INT;

    /**
     * limitation of attachment(byte).
     */
    @Deprecated
    private Long spaceMemoryMaxSize = UNLIMITED_LONG;

    /**
     * Maximum node number.
     */
    @Deprecated
    private Integer nodeMaxCount = UNLIMITED_INT;

    /**
     * Maximum days of recycle bin.
     */
    @Deprecated
    private Integer rubbishRetainDay = UNLIMITED_INT;

    /**
     * Maximum member count of space.
     */
    @Deprecated
    private Integer memberMaxCount = UNLIMITED_INT;

    /**
     * Maximum admin number of space.
     */
    @Deprecated
    private Integer adminMaxCount = UNLIMITED_INT;

    /**
     * Maximum api usage of space.
     */
    @Deprecated
    private Integer apiUsageMaxCount = UNLIMITED_INT;

    /**
     * Maximum dashboard numbers of space.
     */
    private Integer dsbWidgetMaxCount = UNLIMITED_INT;

    /**
     * Maximum robot number of space.
     */
    private Integer dstRobotMaxCount = UNLIMITED_INT;

    /**
     * max limit of trigger count.
     */
    private Integer automationTriggerCount = UNLIMITED_INT;

    /**
     * max limit of action count.
     */
    private Integer automationActionCount = UNLIMITED_INT;

    /**
     * max invited record for a single day.
     */
    private Integer maxInviteCountForFree = UNLIMITED_INT;
}
