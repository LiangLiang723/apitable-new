import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { NodePermissionService } from 'node/services/node.permission.service';
import { NodeService } from 'node/services/node.service';
import { PermissionException, ServerException } from 'shared/exception';
import { UserService } from 'user/services/user.service';
import { TimeMachineService } from '../time.machine.service';

@Controller('nest/v1')
export class TablebundleController {
  constructor(
    private readonly userService: UserService,
    private readonly nodeService: NodeService,
    private readonly nodePermissionService: NodePermissionService,
    private readonly timeMachineService: TimeMachineService,
  ) {}

  @Post('nodes/:nodeId/tablebundles')
  async create(@Headers('cookie') cookie: string, @Param('nodeId') nodeId: string) {
    const { userId } = await this.userService.getMe({ cookie });
    const spaceId = await this.nodeService.checkUserForNode(userId, nodeId);
    await this.checkManagePermission(nodeId, cookie);
    return this.timeMachineService.generateTableBundle(cookie, nodeId, spaceId, userId);
  }

  @Get(['nodes/:nodeId/tablebundles', 'nodes/:nodeId/tablebundles/:tablebundleId'])
  async list(@Headers('cookie') cookie: string, @Param('nodeId') nodeId: string, @Param('tablebundleId') tablebundleId?: string) {
    const { userId } = await this.userService.getMe({ cookie });
    const spaceId = await this.nodeService.checkUserForNode(userId, nodeId);
    await this.nodeService.checkNodePermission(nodeId, { cookie });
    if (tablebundleId) {
      return [await this.timeMachineService.getTableBundleById(tablebundleId, nodeId, spaceId)];
    }
    return this.timeMachineService.getTableBundles(nodeId, spaceId);
  }

  @Put('nodes/:nodeId/tablebundles/:tablebundleId')
  async rename(
    @Headers('cookie') cookie: string,
    @Param('nodeId') nodeId: string,
    @Param('tablebundleId') tablebundleId: string,
    @Body() body: { name: string },
  ) {
    const { userId } = await this.userService.getMe({ cookie });
    const spaceId = await this.nodeService.checkUserForNode(userId, nodeId);
    await this.checkManagePermission(nodeId, cookie);
    await this.timeMachineService.renameTableBundle(tablebundleId, nodeId, spaceId, userId, body.name);
  }

  @Delete('nodes/:nodeId/tablebundles/:tablebundleId')
  async delete(@Headers('cookie') cookie: string, @Param('nodeId') nodeId: string, @Param('tablebundleId') tablebundleId: string) {
    const { userId } = await this.userService.getMe({ cookie });
    const spaceId = await this.nodeService.checkUserForNode(userId, nodeId);
    await this.checkManagePermission(nodeId, cookie);
    await this.timeMachineService.deleteTableBundle(tablebundleId, nodeId, spaceId, userId);
  }

  @Post('nodes/:nodeId/tablebundles/:tablebundleId/recover')
  async recover(
    @Headers('cookie') cookie: string,
    @Param('nodeId') nodeId: string,
    @Param('tablebundleId') tablebundleId: string,
    @Query('folderId') folderId?: string,
    @Query('name') recoverNameSuffix?: string,
  ) {
    const { userId } = await this.userService.getMe({ cookie });
    const spaceId = await this.nodeService.checkUserForNode(userId, nodeId);
    await this.checkManagePermission(nodeId, cookie);
    return this.timeMachineService.recoverTableBundle(cookie, tablebundleId, nodeId, spaceId, userId, folderId, recoverNameSuffix);
  }

  @Get('nodes/:nodeId/tablebundles/:tablebundleId/preview')
  async preview(@Headers('cookie') cookie: string, @Param('nodeId') nodeId: string, @Param('tablebundleId') tablebundleId: string) {
    const { userId } = await this.userService.getMe({ cookie });
    const spaceId = await this.nodeService.checkUserForNode(userId, nodeId);
    await this.nodeService.checkNodePermission(nodeId, { cookie });
    return this.timeMachineService.previewTableBundle(tablebundleId, nodeId, spaceId);
  }

  private async checkManagePermission(nodeId: string, cookie: string) {
    const permission = await this.nodePermissionService.getNodeRole(nodeId, { cookie });
    if (!permission?.manageable) {
      throw new ServerException(PermissionException.OPERATION_DENIED);
    }
  }
}